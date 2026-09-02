using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>Dopina tag do zgłoszenia — idempotentne (TAG-001).</summary>
public sealed class IssueAddTagCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TagUuid { get; set; }
}

public sealed class IssueAddTagCommandHandler : CommandHandler<IssueAddTagCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly ITagRepository _tags;
    private readonly IClock _clock;

    public IssueAddTagCommandHandler(IIssueRepository issues, ITagRepository tags, IClock clock)
    {
        _issues = issues;
        _tags = tags;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueAddTagCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        _ = await _tags.FindAsync(command.TagUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Tags.Tag), command.TagUuid);

        issue.AddTag(command.TagUuid, _clock.UtcNow);

        return issue.Uuid;
    }
}

/// <summary>Odpina tag od zgłoszenia — idempotentne.</summary>
public sealed class IssueRemoveTagCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TagUuid { get; set; }
}

public sealed class IssueRemoveTagCommandHandler : CommandHandler<IssueRemoveTagCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IClock _clock;

    public IssueRemoveTagCommandHandler(IIssueRepository issues, IClock clock)
    {
        _issues = issues;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveTagCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        issue.RemoveTag(command.TagUuid, _clock.UtcNow);

        return issue.Uuid;
    }
}
