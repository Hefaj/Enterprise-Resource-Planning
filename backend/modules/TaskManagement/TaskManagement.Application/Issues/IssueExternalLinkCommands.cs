using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>Dopina link zewnętrzny do zgłoszenia (API-005) — repozytorium, PR, CI, nigdy
/// integracja w domenie.</summary>
public sealed class IssueAddExternalLinkCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Url { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
}

public sealed class IssueAddExternalLinkCommandHandler : CommandHandler<IssueAddExternalLinkCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueAddExternalLinkCommandHandler(
        IIssueRepository issues,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueAddExternalLinkCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var now = _clock.UtcNow;
        issue.AddExternalLink(command.Url, command.Label, now);

        _activity.Add(IssueActivity.Record(
            issue.Uuid,
            IssueActivityKind.ExternalLinkAdded,
            fieldCode: null,
            oldValue: null,
            newValue: command.Label,
            ActorUuid(_executionContext),
            _executionContext.CorrelationId,
            now));

        return issue.Uuid;
    }

    private static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}

/// <summary>Odpina link zewnętrzny.</summary>
public sealed class IssueRemoveExternalLinkCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid LinkUuid { get; set; }
}

public sealed class IssueRemoveExternalLinkCommandHandler : CommandHandler<IssueRemoveExternalLinkCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveExternalLinkCommandHandler(
        IIssueRepository issues,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveExternalLinkCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var removed = issue.ExternalLinks.FirstOrDefault(l => l.Uuid == command.LinkUuid);

        var now = _clock.UtcNow;
        issue.RemoveExternalLink(command.LinkUuid, now);

        _activity.Add(IssueActivity.Record(
            issue.Uuid,
            IssueActivityKind.ExternalLinkRemoved,
            fieldCode: null,
            oldValue: removed?.Label,
            newValue: null,
            ActorUuid(_executionContext),
            _executionContext.CorrelationId,
            now));

        return issue.Uuid;
    }

    private static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}
