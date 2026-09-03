using System.Text;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TaskManagement.Application.Webhooks;
using TaskManagement.Domain.Webhooks;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Jobs;

/// <summary>
/// Dyspozytor dostarczeń webhooka (API-004) — poza transakcją komendy, która wyzwoliła zdarzenie
/// (AC1): <c>WebhookTriggerHandler</c> tylko stawia wiersz <see cref="WebhookDelivery"/> w stanie
/// <c>Pending</c>, a to ten serwis w tle robi właściwy POST, z ponowieniami i wyłączeniem
/// webhooka po serii błędów (patrz <see cref="Webhook.RecordDeliveryFailure"/>).
///
/// <para><b>Nazwa klienta HTTP z timeoutem</b> (<see cref="HttpClientName"/>, rejestracja w
/// <c>TaskManagementInfrastructureExtensions</c>) — bez twardego limitu czasu odpowiedź, która
/// nigdy nie nadchodzi, trzymałaby otwartą transakcję Postgresa (a razem z nią blokadę wiersza)
/// tak długo, jak długo wisi żądanie HTTP.</para>
/// </summary>
[ClusterSafe("FOR UPDATE SKIP LOCKED na wierszu webhook_delivery (WebhookDeliveryLock) w tej samej "
    + "transakcji co próba dostarczenia — dwie instancje nigdy nie wyślą tego samego POST-a dwa razy naraz.")]
public sealed partial class WebhookDeliveryDispatcher : BackgroundService
{
    /// <summary>Nazwa klienta HTTP zarejestrowanego w DI z limitem czasu — patrz
    /// <c>TaskManagementInfrastructureExtensions.AddTaskManagementInfrastructure</c>.</summary>
    public const string HttpClientName = "webhook-delivery";

    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WebhookDeliveryDispatcher> _logger;

    public WebhookDeliveryDispatcher(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        ILogger<WebhookDeliveryDispatcher> logger)
    {
        _scopeFactory = scopeFactory;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PollInterval);

        do
        {
            try
            {
                // Drenuje kolejkę do zera przed czekaniem na kolejny tick — inaczej przy kolejce
                // głębszej niż jedno dostarczenie ten dyspozytor przetwarzałby tylko jedno co 5 s.
                while (await TryProcessNextAsync(stoppingToken).ConfigureAwait(false))
                {
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogTickFailed(_logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    /// <returns><c>true</c>, jeśli było dostarczenie do obsłużenia (warto od razu spróbować
    /// kolejne), <c>false</c>, gdy kolejka jest pusta.</returns>
    private async Task<bool> TryProcessNextAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TaskManagementDbContext>();
        var deliveryLock = scope.ServiceProvider.GetRequiredService<WebhookDeliveryLock>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        await using var transaction = await dbContext.Database
            .BeginTransactionAsync(ct)
            .ConfigureAwait(false);

        var now = clock.UtcNow;
        var deliveryUuid = await deliveryLock.TryLockNextDueAsync(dbContext, now, ct).ConfigureAwait(false);

        if (deliveryUuid is null)
        {
            return false;
        }

        var delivery = await dbContext.WebhookDeliveries
            .FirstAsync(d => d.Uuid == deliveryUuid.Value, ct)
            .ConfigureAwait(false);

        var webhook = await dbContext.Webhooks
            .FirstOrDefaultAsync(w => w.Uuid == delivery.WebhookUuid, ct)
            .ConfigureAwait(false);

        if (webhook is null)
        {
            // Webhook usunięty między utworzeniem dostarczenia a próbą wysyłki (usunięcie NIE
            // kasuje kaskadowo już utworzonych dostarczeń, wzorem AutomationRun po usunięciu
            // reguły) — nie ma komu dostarczyć, dostarczenie po prostu wyczerpuje próby.
            RecordFailure(delivery, null, "Webhook nie istnieje (usunięty).", now);
        }
        else
        {
            await SendAsync(delivery, webhook, now, ct).ConfigureAwait(false);
        }

        await dbContext.SaveChangesAsync(ct).ConfigureAwait(false);
        await transaction.CommitAsync(ct).ConfigureAwait(false);

        return true;
    }

    private async Task SendAsync(WebhookDelivery delivery, Webhook webhook, DateTimeOffset now, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, webhook.Url)
            {
                Content = new StringContent(delivery.PayloadJson, Encoding.UTF8, "application/json"),
            };

            request.Headers.Add("X-Erp-Signature", WebhookSignature.Compute(webhook.Secret, delivery.PayloadJson));
            request.Headers.Add("X-Erp-Event", delivery.EventKind.ToString());
            request.Headers.Add("X-Erp-Delivery", delivery.Uuid.ToString());

            using var response = await client.SendAsync(request, ct).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                delivery.RecordSuccess(now);
                webhook.RecordDeliverySuccess();
                LogDelivered(_logger, delivery.Uuid, webhook.Uuid, (int)response.StatusCode);
                return;
            }

            RecordFailure(delivery, webhook, $"HTTP {(int)response.StatusCode}", now);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            RecordFailure(delivery, webhook, ex.Message, now);
        }
    }

    /// <summary>Odstęp rośnie wykładniczo z liczbą DOTYCHCZASOWYCH prób (15 s, 30 s, 60 s, 120 s) —
    /// martwy odbiorca nie ma dostawać POST-a co 5 sekund przez cały czas życia dostarczenia.</summary>
    private void RecordFailure(WebhookDelivery delivery, Webhook? webhook, string error, DateTimeOffset now)
    {
        var backoff = TimeSpan.FromSeconds(Math.Pow(2, delivery.AttemptCount) * 15);
        var exhausted = delivery.RecordFailure(error, now, backoff);

        if (!exhausted)
        {
            LogDeliveryRetrying(_logger, delivery.Uuid, delivery.AttemptCount, error);
            return;
        }

        webhook?.RecordDeliveryFailure();
        LogDeliveryExhausted(_logger, delivery.Uuid, error);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Error,
        Message = "Dyspozytor webhooków: cykl nie powiódł się, spróbuję ponownie za 5 sekund.")]
    private static partial void LogTickFailed(ILogger logger, Exception ex);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information,
        Message = "Webhook {WebhookUuid}: dostarczenie {DeliveryUuid} wysłane (HTTP {StatusCode}).")]
    private static partial void LogDelivered(ILogger logger, Guid deliveryUuid, Guid webhookUuid, int statusCode);

    [LoggerMessage(EventId = 3, Level = LogLevel.Warning,
        Message = "Dostarczenie {DeliveryUuid}: próba {AttemptCount} nieudana ({Error}), ponowię z odstępem.")]
    private static partial void LogDeliveryRetrying(ILogger logger, Guid deliveryUuid, int attemptCount, string error);

    [LoggerMessage(EventId = 4, Level = LogLevel.Error,
        Message = "Dostarczenie {DeliveryUuid} wyczerpało wszystkie próby ({Error}).")]
    private static partial void LogDeliveryExhausted(ILogger logger, Guid deliveryUuid, string error);
}
