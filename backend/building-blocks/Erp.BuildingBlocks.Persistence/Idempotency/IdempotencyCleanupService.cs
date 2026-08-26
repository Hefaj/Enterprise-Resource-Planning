using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Commands;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Erp.BuildingBlocks.Persistence.Idempotency;

/// <summary>
/// Usuwa wygasłe klucze idempotencji.
///
/// <para>Tabela rośnie o wiersz na każde żądanie zapisu z nagłówkiem <c>X-Request-Id</c>
/// i nic jej nie zmniejsza — bez sprzątania po roku pracy indeks kluczy byłby większy niż
/// dane, których dotyczy. Usuwanie idzie jednym <c>DELETE</c> po indeksie na <c>expires_at</c>,
/// bez materializowania wierszy.</para>
///
/// <para>Wygaśnięcie jest już respektowane przy odczycie (<see cref="EfIdempotencyStore{TContext}"/>),
/// więc ta usługa odpowiada wyłącznie za rozmiar tabeli — jej przestój niczego nie psuje poza
/// zajętością dysku.</para>
///
/// <para><b>Wiele instancji nie wymaga tu niczego</b> — i to jest cała odpowiedź, nie jej brak.
/// Sprzątanie to jedno <c>ExecuteDelete</c> po predykacie wygaśnięcia: druga instancja robiąca
/// to samo w tej samej chwili usuwa zero wierszy, bo pierwsza już je zabrała. Dokładanie tu
/// dzierżawy byłoby kosztem bez odpowiadającego mu ryzyka.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu.</typeparam>
[ClusterSafe("Jedno ExecuteDelete po wygasłych kluczach — druga instancja usuwa zero wierszy, "
    + "więc równoległy przebieg jest naturalnie bezpieczny i nie potrzebuje dzierżawy.")]
public sealed partial class IdempotencyCleanupService<TContext> : BackgroundService
    where TContext : ErpDbContext
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly CommandPipelineOptions _options;
    private readonly ILogger<IdempotencyCleanupService<TContext>> _logger;

    public IdempotencyCleanupService(
        IServiceScopeFactory scopeFactory,
        IOptions<CommandPipelineOptions> options,
        ILogger<IdempotencyCleanupService<TContext>> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options?.Value ?? new CommandPipelineOptions();
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_options.IdempotencyCleanupInterval, stoppingToken).ConfigureAwait(false);
                await CleanupAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
#pragma warning disable CA1031 // Sprzątanie nie może położyć hosta ani przerwać własnej pętli.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                LogCleanupFailed(_logger, ex);
            }
        }
    }

    private async Task CleanupAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        var now = clock.UtcNow;

        var removed = await db.Set<IdempotencyRecord>()
            .Where(r => r.ExpiresAt <= now)
            .ExecuteDeleteAsync(cancellationToken)
            .ConfigureAwait(false);

        if (removed > 0)
        {
            LogCleaned(_logger, removed, typeof(TContext).Name);
        }
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Debug,
        Message = "Usunięto {Count} wygasłych kluczy idempotencji ({Context}).")]
    private static partial void LogCleaned(ILogger logger, int count, string context);

    [LoggerMessage(EventId = 2, Level = LogLevel.Warning,
        Message = "Sprzątanie kluczy idempotencji nie powiodło się.")]
    private static partial void LogCleanupFailed(ILogger logger, Exception exception);
}
