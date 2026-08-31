using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Przenosi zgłoszenie do innego projektu.
///
/// <para><c>Issue.MoveToProject</c> istniało w domenie od fazy 4, ale nie miało wołającego —
/// przez co kolumna <c>previous_keys</c> nigdy się nie zapełniała, a cała (poprawnie napisana)
/// ścieżka odczytu po kluczu historycznym w <c>getIssueByKey</c> była nieosiągalna. To jest
/// brakująca komenda z §12.</para>
///
/// <para><b>Trzy skutki, wszystkie zamierzone.</b> Zgłoszenie dostaje <b>nowy klucz</b> z licznika
/// projektu docelowego (stary ląduje w <c>previous_keys</c>, więc dawne linki nadal działają, §4).
/// Stan wraca do <b>początkowego stanu docelowego schematu</b> — automatu stanów nie da się
/// przenieść razem ze zgłoszeniem, a zgadywanie odpowiednika stanu w cudzym schemacie byłoby
/// zgadywaniem. Wartości pól niestandardowych <b>zostają</b> w <c>custom_fields</c>: kasowanie
/// danych przy zmianie konfiguracji jest nieodwracalne, a ta operacja na taką nie wygląda —
/// pola spoza schematu docelowego po prostu się nie wyświetlą.</para>
/// </summary>
public sealed class IssueSetProjectCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid ProjectUuid { get; set; }
}

public sealed class IssueSetProjectCommandHandler : CommandHandler<IssueSetProjectCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IProjectRepository _projects;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IIssueKeyAllocator _keys;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueSetProjectCommandHandler(
        IIssueRepository issues,
        IProjectRepository projects,
        IWorkflowSchemeRepository schemes,
        IIssueKeyAllocator keys,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _projects = projects;
        _schemes = schemes;
        _keys = keys;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetProjectCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        if (issue.ProjectUuid == command.ProjectUuid)
        {
            return issue.Uuid;
        }

        _ = await _projects.FindAsync(command.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.ProjectUuid);

        var targetScheme = await _schemes.FindByProjectAsync(command.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.ProjectUuid);

        // Zgłoszenie z podzadaniami zostawiłoby je w starym projekcie, wiszące pod rodzicem spoza
        // ich granicy widoczności i numeracji. Przenoszenie poddrzewa jest osobną decyzją
        // (i osobną komendą), więc tutaj odmawiamy zamiast po cichu rozerwać hierarchię.
        if (issue.ParentUuid is not null)
        {
            throw new DomainException(
                "taskmgmt.issue_move_child",
                "Najpierw odepnij zgłoszenie od rodzica — przeniesienie dotyczy zgłoszenia, nie poddrzewa.");
        }

        var previousKey = issue.Key;
        var previousProject = issue.ProjectUuid;
        var newKey = await _keys.AllocateAsync(command.ProjectUuid, ct).ConfigureAwait(false);
        var now = _clock.UtcNow;

        issue.MoveToProject(command.ProjectUuid, newKey, targetScheme, now);

        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);
        _activity.Add(IssueActivity.Record(issue.Uuid, IssueActivityKind.FieldChanged, "project", previousProject.ToString(), command.ProjectUuid.ToString(), actor, _executionContext.CorrelationId, now));
        _activity.Add(IssueActivity.Record(issue.Uuid, IssueActivityKind.FieldChanged, "key", previousKey, issue.Key, actor, _executionContext.CorrelationId, now));

        return issue.Uuid;
    }
}
