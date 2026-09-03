using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Webhooks;

namespace TaskManagement.Application.Webhooks;

/// <summary>Zakłada webhook (API-004).</summary>
public sealed class WebhookCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tryb <c>Commands[]</c>.</summary>
    public Guid Uuid { get; set; }

    public Guid ProjectUuid { get; set; }

    public string Url { get; set; } = string.Empty;

    public string Secret { get; set; } = string.Empty;

    public List<AutomationTriggerKind> EventKinds { get; set; } = [];
}

public sealed class WebhookCreateCommandHandler : CommandHandler<WebhookCreateCommand, Guid>
{
    private readonly IWebhookRepository _webhooks;
    private readonly IClock _clock;

    public WebhookCreateCommandHandler(IWebhookRepository webhooks, IClock clock)
    {
        _webhooks = webhooks;
        _clock = clock;
    }

    public override Task<Guid> ExecuteAsync(WebhookCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var webhook = Webhook.CreateWithUuid(
            command.Uuid, command.ProjectUuid, command.Url, command.Secret, command.EventKinds, _clock.UtcNow);

        _webhooks.Add(webhook);

        return Task.FromResult(webhook.Uuid);
    }
}

/// <summary>Nadpisuje adres, sekret i subskrybowane zdarzenia naraz — wzorem
/// <c>AutomationRuleSetCommand</c>.</summary>
public sealed class WebhookSetCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Url { get; set; } = string.Empty;

    public string Secret { get; set; } = string.Empty;

    public List<AutomationTriggerKind> EventKinds { get; set; } = [];
}

public sealed class WebhookSetCommandHandler : CommandHandler<WebhookSetCommand, Guid>
{
    private readonly IWebhookRepository _webhooks;

    public WebhookSetCommandHandler(IWebhookRepository webhooks) => _webhooks = webhooks;

    public override async Task<Guid> ExecuteAsync(WebhookSetCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var webhook = await _webhooks.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Webhook), command.Uuid);

        // `WebhookDto` świadomie nie niesie sekretu z powrotem do frontu (żeby nie wyciekał przy
        // każdym odczycie), więc edytor nie ma czego wyświetlić ani ponownie wysłać — pusty
        // sekret w komendzie znaczy „zostaw ten, który już jest", nie „ustaw pusty" (`Webhook.Set`
        // i tak by to odrzucił jako `taskmgmt.webhook_secret_empty`).
        var secret = string.IsNullOrWhiteSpace(command.Secret) ? webhook.Secret : command.Secret;

        webhook.Set(command.Url, secret, command.EventKinds);

        return webhook.Uuid;
    }
}

/// <summary>Włącza webhook bez zmiany treści i resetuje licznik błędów (API-004) —
/// wzorem <c>AutomationRuleExecEnableCommand</c>.</summary>
public sealed class WebhookExecEnableCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class WebhookExecEnableCommandHandler : CommandHandler<WebhookExecEnableCommand, Guid>
{
    private readonly IWebhookRepository _webhooks;

    public WebhookExecEnableCommandHandler(IWebhookRepository webhooks) => _webhooks = webhooks;

    public override async Task<Guid> ExecuteAsync(WebhookExecEnableCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var webhook = await _webhooks.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Webhook), command.Uuid);

        webhook.Enable();

        return webhook.Uuid;
    }
}

/// <summary>Wyłącza webhook <b>bez usuwania</b> — dostarczenia już utworzone dokańczają swoje
/// próby ponowienia (dyspozytor filtruje po statusie dostarczenia, nie po stanie webhooka),
/// nowe zdarzenia po prostu nie tworzą kolejnych.</summary>
public sealed class WebhookExecDisableCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class WebhookExecDisableCommandHandler : CommandHandler<WebhookExecDisableCommand, Guid>
{
    private readonly IWebhookRepository _webhooks;

    public WebhookExecDisableCommandHandler(IWebhookRepository webhooks) => _webhooks = webhooks;

    public override async Task<Guid> ExecuteAsync(WebhookExecDisableCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var webhook = await _webhooks.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Webhook), command.Uuid);

        webhook.Disable();

        return webhook.Uuid;
    }
}

public sealed class WebhookRemoveCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class WebhookRemoveCommandHandler : CommandHandler<WebhookRemoveCommand, Guid>
{
    private readonly IWebhookRepository _webhooks;

    public WebhookRemoveCommandHandler(IWebhookRepository webhooks) => _webhooks = webhooks;

    public override async Task<Guid> ExecuteAsync(WebhookRemoveCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var webhook = await _webhooks.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Webhook), command.Uuid);

        _webhooks.Remove(webhook);

        return webhook.Uuid;
    }
}
