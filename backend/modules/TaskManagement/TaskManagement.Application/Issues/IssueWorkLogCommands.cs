using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.WorkTypes;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Dodanie wpisu czasu (TIME-001). <c>Uuid</c> to identyfikator <b>wpisu</b>, nie zgłoszenia —
/// wzorem <see cref="IssueAddCommentCommand"/>, z tego samego powodu: tryb <c>Commands[]</c>
/// potrzebuje identyfikatora w treści żądania.
/// </summary>
public sealed class IssueAddWorkLogCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid zakładanego wpisu.</summary>
    public Guid Uuid { get; set; }

    public Guid IssueUuid { get; set; }

    public Guid WorkTypeUuid { get; set; }

    public DateOnly LoggedOn { get; set; }

    public int Minutes { get; set; }

    public string? Description { get; set; }
}

public sealed class IssueAddWorkLogCommandHandler : CommandHandler<IssueAddWorkLogCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IIssueWorkLogRepository _workLogs;
    private readonly IWorkTypeRepository _workTypes;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueAddWorkLogCommandHandler(
        IIssueRepository issues,
        IIssueWorkLogRepository workLogs,
        IWorkTypeRepository workTypes,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _workLogs = workLogs;
        _workTypes = workTypes;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueAddWorkLogCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.IssueUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.IssueUuid);

        _ = await _workTypes.FindAsync(command.WorkTypeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkType), command.WorkTypeUuid);

        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);
        var now = _clock.UtcNow;

        var workLog = IssueWorkLog.CreateWithUuid(
            command.Uuid,
            issue.Uuid,
            actor,
            command.WorkTypeUuid,
            command.LoggedOn,
            command.Minutes,
            command.Description,
            now);

        _workLogs.Add(workLog);

        _activity.Add(IssueActivity.Record(
            issue.Uuid,
            IssueActivityKind.WorkLogAdded,
            fieldCode: command.WorkTypeUuid.ToString(),
            oldValue: null,
            newValue: command.Minutes.ToString(System.Globalization.CultureInfo.InvariantCulture),
            actor,
            _executionContext.CorrelationId,
            now));

        return workLog.Uuid;
    }
}

/// <summary>Usunięcie wpisu czasu — twarde, patrz uzasadnienie przy <see cref="IssueWorkLog"/>.
/// Może usunąć wyłącznie autor wpisu — cudzy wpis czasu zniekształcałby czyjś rejestr pracy.</summary>
public sealed class IssueRemoveWorkLogCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid wpisu.</summary>
    public Guid Uuid { get; set; }
}

public sealed class IssueRemoveWorkLogCommandHandler : CommandHandler<IssueRemoveWorkLogCommand, Guid>
{
    private readonly IIssueWorkLogRepository _workLogs;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveWorkLogCommandHandler(
        IIssueWorkLogRepository workLogs,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _workLogs = workLogs;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveWorkLogCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var workLog = await _workLogs.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueWorkLog), command.Uuid);

        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);

        if (workLog.UserUuid != actor)
        {
            throw new DomainException(
                "taskmgmt.work_log_not_author",
                "Wpis czasu może usunąć wyłącznie jego autor.");
        }

        _workLogs.Remove(workLog);

        _activity.Add(IssueActivity.Record(
            workLog.IssueUuid,
            IssueActivityKind.WorkLogRemoved,
            fieldCode: workLog.WorkTypeUuid.ToString(),
            oldValue: workLog.Minutes.ToString(System.Globalization.CultureInfo.InvariantCulture),
            newValue: null,
            actor,
            _executionContext.CorrelationId,
            _clock.UtcNow));

        return workLog.Uuid;
    }
}

/// <summary>Ustawia estymatę zgłoszenia (TIME-002). <c>null</c> czyści estymatę.</summary>
public sealed class IssueSetEstimateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public int? EstimateMinutes { get; set; }
}

public sealed class IssueSetEstimateCommandHandler : CommandHandler<IssueSetEstimateCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IClock _clock;

    public IssueSetEstimateCommandHandler(IIssueRepository issues, IClock clock)
    {
        _issues = issues;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetEstimateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        issue.SetEstimate(command.EstimateMinutes, _clock.UtcNow);

        return issue.Uuid;
    }
}
