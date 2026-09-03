using System.Text.Json;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Automation;

/// <summary>
/// Wykonuje jedną akcję reguły (AUT-001 `then`) — mapuje <see cref="AutomationAction.ConfigJson"/>
/// na istniejącą komendę zgłoszenia i wysyła ją przez <see cref="ICommandDispatcher"/>, dokładnie
/// tak, jakby przyszła z HTTP. Efekt trafia do historii zgłoszenia oznaczony jako automatyczny,
/// bo w tym momencie <see cref="IExecutionContext.AutomationRuleUuid"/> jest już ustawione przez
/// <see cref="AutomationRuleEvaluator"/> — ten wykonawca sam niczego nie zapisuje w historii.
///
/// <para><see cref="AutomationAction.ConfigJson"/> jest opaque przy zapisie reguły (patrz
/// <see cref="AutomationActionRequest"/>) — błędny kształt konfiguracji ujawnia się DOPIERO tutaj,
/// jako <see cref="JsonException"/>/<see cref="FormatException"/> propagowany do wołającego, który
/// zapisuje go jako <see cref="AutomationRun.Failed"/> zamiast wywalać całą ewaluację reguły.</para>
/// </summary>
public sealed class AutomationActionExecutor
{
    private readonly ICommandDispatcher _dispatcher;
    private readonly IssueNotificationPublisher _notifications;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public AutomationActionExecutor(
        ICommandDispatcher dispatcher,
        IssueNotificationPublisher notifications,
        IExecutionContext executionContext,
        IClock clock)
    {
        _dispatcher = dispatcher;
        _notifications = notifications;
        _executionContext = executionContext;
        _clock = clock;
    }

    public async Task ExecuteAsync(AutomationAction action, Issue issue, string ruleName, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(action);
        ArgumentNullException.ThrowIfNull(issue);

        switch (action.Kind)
        {
            case AutomationActionKind.SetPriority:
                await _dispatcher.SendAsync<IssueSetPriorityCommand, Guid>(
                    new IssueSetPriorityCommand
                    {
                        Uuid = issue.Uuid,
                        Priority = ReadConfig<PriorityConfig>(action.ConfigJson).Priority,
                    },
                    ct).ConfigureAwait(false);
                break;

            case AutomationActionKind.SetState:
                await _dispatcher.SendAsync<IssueSetStateCommand, Guid>(
                    new IssueSetStateCommand
                    {
                        Uuid = issue.Uuid,
                        StateUuid = ReadConfig<StateConfig>(action.ConfigJson).StateUuid,
                    },
                    ct).ConfigureAwait(false);
                break;

            case AutomationActionKind.AssignTo:
                await _dispatcher.SendAsync<IssueSetAssigneeCommand, Guid>(
                    new IssueSetAssigneeCommand
                    {
                        Uuid = issue.Uuid,
                        AssigneeUuid = ReadConfig<AssigneeConfig>(action.ConfigJson).AssigneeUuid,
                    },
                    ct).ConfigureAwait(false);
                break;

            case AutomationActionKind.AddTag:
                await _dispatcher.SendAsync<IssueAddTagCommand, Guid>(
                    new IssueAddTagCommand
                    {
                        Uuid = issue.Uuid,
                        TagUuid = ReadConfig<TagConfig>(action.ConfigJson).TagUuid,
                    },
                    ct).ConfigureAwait(false);
                break;

            case AutomationActionKind.AddComment:
                await _dispatcher.SendAsync<IssueAddCommentCommand, Guid>(
                    new IssueAddCommentCommand
                    {
                        Uuid = Guid.CreateVersion7(),
                        IssueUuid = issue.Uuid,
                        Body = ReadConfig<CommentConfig>(action.ConfigJson).Body,
                    },
                    ct).ConfigureAwait(false);
                break;

            case AutomationActionKind.SendNotification:
                await _notifications
                    .PublishAutomationAsync(issue, ruleName, _clock.UtcNow, _executionContext.CorrelationId, ct)
                    .ConfigureAwait(false);
                break;

            case AutomationActionKind.CreateSubtask:
                await CreateSubtaskAsync(action, issue, ct).ConfigureAwait(false);
                break;

            default:
                throw new NotSupportedException($"Rodzaj akcji `{action.Kind}` nie jest obsługiwany.");
        }
    }

    private async Task CreateSubtaskAsync(AutomationAction action, Issue parent, CancellationToken ct)
    {
        var config = ReadConfig<SubtaskConfig>(action.ConfigJson);
        var subtaskUuid = Guid.CreateVersion7();

        await _dispatcher.SendAsync<IssueCreateCommand, Guid>(
            new IssueCreateCommand
            {
                Uuid = subtaskUuid,
                ProjectUuid = parent.ProjectUuid,
                TypeUuid = config.TypeUuid,
                Title = string.IsNullOrWhiteSpace(config.Title) ? $"Podzadanie {parent.Key}" : config.Title,
            },
            ct).ConfigureAwait(false);

        await _dispatcher.SendAsync<IssueSetParentCommand, Guid>(
            new IssueSetParentCommand { Uuid = subtaskUuid, ParentUuid = parent.Uuid },
            ct).ConfigureAwait(false);
    }

    /// <summary>Front serializuje konfigurację akcji camelCase (`{"priority":4}`), rekordy niżej są
    /// PascalCase — bez tej opcji `JsonSerializer.Deserialize` (case-sensitive domyślnie) po cichu
    /// zostawia właściwość na wartości domyślnej zamiast rzucić błąd (np. `Priority` = `Lowest`
    /// niezależnie od tego, co wybrano w edytorze reguły).</summary>
    private static readonly JsonSerializerOptions ConfigJsonOptions = new() { PropertyNameCaseInsensitive = true };

    private static T ReadConfig<T>(string configJson)
        => JsonSerializer.Deserialize<T>(configJson, ConfigJsonOptions)
            ?? throw new FormatException($"Konfiguracja akcji jest pusta — oczekiwano `{typeof(T).Name}`.");

    private sealed record PriorityConfig(IssuePriority Priority);

    private sealed record StateConfig(Guid StateUuid);

    private sealed record AssigneeConfig(Guid? AssigneeUuid);

    private sealed record TagConfig(Guid TagUuid);

    private sealed record CommentConfig(string Body);

    private sealed record SubtaskConfig(Guid TypeUuid, string? Title);
}
