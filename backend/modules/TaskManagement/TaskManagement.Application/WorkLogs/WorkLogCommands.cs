using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.WorkLogs;

/// <summary>
/// Zalogowanie pracy na zgłoszeniu.
///
/// <para><b>Własny namespace, nie <c>Issues</c></b>: <see cref="WorkLog"/> jest osobnym agregatem
/// (własna tabela, własne repozytorium), a konwencja nazewnicza wiąże prefiks komendy z agregatem,
/// w którego folderze leży (<c>docs/backend/endpoint-naming.md</c> §9). Trzymana w <c>Issues</c>
/// wyglądała na komendę zgłoszenia, którą nie jest.</para>
/// </summary>
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
