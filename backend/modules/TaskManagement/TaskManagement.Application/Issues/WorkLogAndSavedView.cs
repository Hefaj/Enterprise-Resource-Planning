using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

public sealed class WorkLogCreateCommand : ICommand<Guid>
{
    public Guid IssueUuid { get; set; }
    public int Minutes { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset LoggedAt { get; set; }
}

public sealed class WorkLogCreateCommandHandler : CommandHandler<WorkLogCreateCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IWorkLogRepository _workLogs;
    private readonly IExecutionContext _context;
    private readonly IClock _clock;

    public WorkLogCreateCommandHandler(IIssueRepository issues, IWorkLogRepository workLogs, IExecutionContext context, IClock clock)
        => (_issues, _workLogs, _context, _clock) = (issues, workLogs, context, clock);

    public override async Task<Guid> ExecuteAsync(WorkLogCreateCommand command, CancellationToken ct = default)
    {
        if (await _issues.FindAsync(command.IssueUuid, ct).ConfigureAwait(false) is null)
            throw new AggregateNotFoundException(nameof(Issue), command.IssueUuid);

        var author = IssueCreateCommandHandler.ActorUuid(_context);
        var workLog = WorkLog.Create(command.IssueUuid, author, command.Minutes, command.Note,
            command.LoggedAt == default ? _clock.UtcNow : command.LoggedAt, _clock.UtcNow);
        _workLogs.Add(workLog);
        return workLog.Uuid;
    }
}

public sealed class SavedIssueViewCreateCommand : ICommand<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string FilterJson { get; set; } = "{}";
    public string ColumnsJson { get; set; } = "[]";
    public bool IsDefault { get; set; }
}

public sealed class SavedIssueViewCreateCommandHandler : CommandHandler<SavedIssueViewCreateCommand, Guid>
{
    private readonly ISavedIssueViewRepository _repository;
    private readonly IExecutionContext _context;
    private readonly IClock _clock;
    public SavedIssueViewCreateCommandHandler(ISavedIssueViewRepository repository, IExecutionContext context, IClock clock)
        => (_repository, _context, _clock) = (repository, context, clock);

    public override Task<Guid> ExecuteAsync(SavedIssueViewCreateCommand command, CancellationToken ct = default)
    {
        var view = SavedIssueView.Create(IssueCreateCommandHandler.ActorUuid(_context), command.Name, command.FilterJson, command.ColumnsJson, command.IsDefault, _clock.UtcNow);
        _repository.Add(view);
        return Task.FromResult(view.Uuid);
    }
}

public sealed class SavedIssueViewUpdateCommand : ICommand<Guid>
{
    public Guid Uuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FilterJson { get; set; } = "{}";
    public string ColumnsJson { get; set; } = "[]";
    public bool IsDefault { get; set; }
}

public sealed class SavedIssueViewUpdateCommandHandler : CommandHandler<SavedIssueViewUpdateCommand, Guid>
{
    private readonly ISavedIssueViewRepository _repository;
    private readonly IExecutionContext _context;
    private readonly IClock _clock;
    public SavedIssueViewUpdateCommandHandler(ISavedIssueViewRepository repository, IExecutionContext context, IClock clock)
        => (_repository, _context, _clock) = (repository, context, clock);

    public override async Task<Guid> ExecuteAsync(SavedIssueViewUpdateCommand command, CancellationToken ct = default)
    {
        var view = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(SavedIssueView), command.Uuid);
        if (view.OwnerUuid != IssueCreateCommandHandler.ActorUuid(_context))
            throw new DomainException("taskmgmt.saved_view_forbidden", "Można zmieniać tylko własny zapisany widok.");
        view.Update(command.Name, command.FilterJson, command.ColumnsJson, command.IsDefault, _clock.UtcNow);
        return view.Uuid;
    }
}

public sealed record WorkLogDto(Guid Uuid, Guid IssueUuid, Guid AuthorUuid, int Minutes, string? Note, DateTimeOffset LoggedAt);
public sealed record SavedIssueViewDto(Guid Uuid, string Name, string FilterJson, string ColumnsJson, bool IsDefault);
public sealed class GetIssueWorkLogsRequest { public Guid IssueUuid { get; set; } }

public interface IWorkLogQueries
{
    Task<IReadOnlyList<WorkLogDto>> GetForIssueAsync(Guid issueUuid, CancellationToken cancellationToken);
    Task<IReadOnlyList<SavedIssueViewDto>> GetSavedViewsAsync(CancellationToken cancellationToken);
}
