using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>Jawne „obserwuję" — dodaje siebie do obserwatorów zgłoszenia, czyszcząc wcześniejszą
/// rezygnację, jeśli była (ISS-009).</summary>
public sealed class IssueAddWatcherCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class IssueAddWatcherCommandHandler : CommandHandler<IssueAddWatcherCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueAddWatcherCommandHandler(IIssueRepository issues, IExecutionContext executionContext, IClock clock)
    {
        _issues = issues;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueAddWatcherCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        issue.Watch(IssueCreateCommandHandler.ActorUuid(_executionContext), _clock.UtcNow);

        return issue.Uuid;
    }
}

/// <summary>Jawna rezygnacja z obserwowania — trwała, patrz <see cref="IssueWatcher"/>.</summary>
public sealed class IssueRemoveWatcherCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class IssueRemoveWatcherCommandHandler : CommandHandler<IssueRemoveWatcherCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveWatcherCommandHandler(IIssueRepository issues, IExecutionContext executionContext, IClock clock)
    {
        _issues = issues;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveWatcherCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        issue.Unwatch(IssueCreateCommandHandler.ActorUuid(_executionContext), _clock.UtcNow);

        return issue.Uuid;
    }
}
