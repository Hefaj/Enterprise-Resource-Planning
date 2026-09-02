using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Przeniesienie zgłoszenia do innego projektu (ISS-010) — nadaje nowy klucz, zachowuje stary
/// w <see cref="Issue.PreviousKeys"/> i przenosi <b>całe poddrzewo</b> potomków razem z nim
/// (AC3), jednym wywołaniem komendy: cel operacji masowej jest tylko korzeń, a nie każdy
/// potomek osobno — inaczej wybór „przenieś tylko rodzica” byłby możliwym (błędnym) stanem
/// pośrednim między dwoma chunkami zadania.
/// </summary>
public sealed class IssueSetProjectCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TargetProjectUuid { get; set; }

    /// <summary>Decyzja o polach niestandardowych bez odpowiednika w docelowym schemacie
    /// (ISS-010 AC4) — klucz to kod pola źródłowego, wartość to kod pola docelowego, na które
    /// przenieść wartość, albo <c>null</c>, żeby ją odrzucić. Pole pominięte w mapie też
    /// zostaje odrzucone — ekran decyzji pokazuje WSZYSTKIE pola bez odpowiednika, więc brak
    /// wpisu znaczy, że użytkownik zobaczył i nie wybrał żadnego celu.</summary>
    public Dictionary<string, string?>? FieldDecisions { get; set; }
}

public sealed class IssueSetProjectCommandHandler : CommandHandler<IssueSetProjectCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IProjectRepository _projects;
    private readonly IIssueTypeSchemeRepository _issueTypeSchemes;
    private readonly IWorkflowSchemeRepository _workflowSchemes;
    private readonly IFieldSchemeRepository _fieldSchemes;
    private readonly IIssueKeyAllocator _keyAllocator;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueSetProjectCommandHandler(
        IIssueRepository issues,
        IProjectRepository projects,
        IIssueTypeSchemeRepository issueTypeSchemes,
        IWorkflowSchemeRepository workflowSchemes,
        IFieldSchemeRepository fieldSchemes,
        IIssueKeyAllocator keyAllocator,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _projects = projects;
        _issueTypeSchemes = issueTypeSchemes;
        _workflowSchemes = workflowSchemes;
        _fieldSchemes = fieldSchemes;
        _keyAllocator = keyAllocator;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetProjectCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var root = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        if (root.ProjectUuid == command.TargetProjectUuid)
        {
            return root.Uuid;
        }

        var targetProject = await _projects.FindAsync(command.TargetProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.TargetProjectUuid);

        var targetTypeScheme = await _issueTypeSchemes.FindByProjectAsync(command.TargetProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.TargetProjectUuid);

        var targetFieldScheme = await _fieldSchemes.FindByProjectAsync(command.TargetProjectUuid, ct).ConfigureAwait(false);

        var descendants = await _issues.FindDescendantsAsync(root.Uuid, ct).ConfigureAwait(false);
        var subtree = new List<Issue> { root };
        subtree.AddRange(descendants);

        // Faza 1 — WALIDACJA CAŁEGO PODDRZEWA, bez żadnej mutacji. Przeniesienie rodzica
        // i dzieci jest jedną operacją: rodzic bez odpowiednika typu w projekcie docelowym nie
        // może przenieść się sam, zostawiając dzieci z tyłu w projekcie, którego już nie mają
        // jak wskazać jako rodzica (SetParent wymaga tego samego projektu co dziecko).
        var plans = new List<(Issue Issue, WorkflowScheme TargetScheme)>(subtree.Count);
        var workflowSchemeCache = new Dictionary<Guid, WorkflowScheme>();

        foreach (var issue in subtree)
        {
            var targetType = targetTypeScheme.FindByUuid(issue.TypeUuid)
                ?? throw new DomainException(
                    "taskmgmt.issue_type_not_in_target_project",
                    $"Typ zgłoszenia {issue.Key} nie należy do schematu typów projektu docelowego `{targetProject.Name}`.");

            var workflowSchemeUuid = targetType.WorkflowSchemeUuid ?? targetProject.WorkflowSchemeUuid;

            if (!workflowSchemeCache.TryGetValue(workflowSchemeUuid, out var targetScheme))
            {
                targetScheme = await _workflowSchemes.FindAsync(workflowSchemeUuid, ct).ConfigureAwait(false)
                    ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), workflowSchemeUuid);
                workflowSchemeCache[workflowSchemeUuid] = targetScheme;
            }

            plans.Add((issue, targetScheme));
        }

        // Faza 2 — nadanie kluczy jednym przeskokiem licznika (jeden UPDATE zamiast N) i wykonanie.
        var newKeys = await _keyAllocator.AllocateRangeAsync(command.TargetProjectUuid, plans.Count, ct)
            .ConfigureAwait(false);

        var now = _clock.UtcNow;
        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);

        for (var i = 0; i < plans.Count; i++)
        {
            var (issue, targetScheme) = plans[i];
            var previousProjectUuid = issue.ProjectUuid;
            var previousKey = issue.Key;

            issue.MoveToProject(command.TargetProjectUuid, newKeys[i], targetScheme, now);

            ApplyFieldDecisions(issue, targetFieldScheme, command.FieldDecisions, now);

            _activity.Add(IssueActivity.Record(
                issue.Uuid,
                IssueActivityKind.FieldChanged,
                "project",
                $"{previousProjectUuid}:{previousKey}",
                $"{issue.ProjectUuid}:{issue.Key}",
                actor,
                _executionContext.CorrelationId,
                now));
        }

        return root.Uuid;
    }

    /// <summary>Pola bez odpowiednika w docelowym schemacie nie znikają po cichu (ISS-010 AC4)
    /// — trafiają pod kod wskazany w decyzji użytkownika albo, bez decyzji, zostają odrzucone
    /// jawnym wywołaniem <see cref="Issue.SetCustomFields"/>, nie milczącym pominięciem.</summary>
    private static void ApplyFieldDecisions(
        Issue issue,
        FieldScheme? targetFieldScheme,
        Dictionary<string, string?>? decisions,
        DateTimeOffset now)
    {
        if (targetFieldScheme is null)
        {
            return;
        }

        var merged = new Dictionary<string, string?>();

        foreach (var (code, value) in issue.CustomFields)
        {
            if (targetFieldScheme.FindByCode(code) is not null)
            {
                merged[code] = value;
                continue;
            }

            if (decisions is not null
                && decisions.TryGetValue(code, out var targetCode)
                && targetCode is not null
                && targetFieldScheme.FindByCode(targetCode) is not null)
            {
                merged[targetCode] = value;
            }
        }

        issue.SetCustomFields(targetFieldScheme, merged, now);
    }
}
