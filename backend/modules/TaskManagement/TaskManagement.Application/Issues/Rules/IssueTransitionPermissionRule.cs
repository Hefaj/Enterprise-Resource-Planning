using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Validation;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Reguła wsadowa: przejście, którego krawędź w schemacie niesie <c>required_permission</c>,
/// mogą wykonać wyłącznie osoby mające ten kod (<c>docs/backend/task-management.md</c> §5.2).
///
/// <para><b>Dlaczego to pre-check, nie sprawdzenie w handlerze.</b> Zmiana stanu zawsze idzie
/// przez <c>job</c>/<c>job_item</c> — nawet pojedyncze przejście z karty zgłoszenia trafia do
/// <c>IssueSetStateMultipleCommandEndpoint</c> jako wsad jednoelementowy. Wykonanie dzieje się
/// później, w <c>BulkCommandRunner</c>, który odtwarza <see cref="IExecutionContext"/> z wiersza
/// <c>job</c> — a ten nie niesie uprawnień wołającego (patrz komentarz na
/// <see cref="IExecutionContext.Permissions"/>). Jedyny moment, w którym <c>ClaimsPrincipal</c>
/// żądania jeszcze istnieje, to pre-check w żądaniu HTTP, więc TU i tylko TU da się to sprawdzić —
/// dokładnie tak, jak §12 dokumentu opisuje tę regułę: „uprawnienie na przejściu" jako pozycja
/// tabeli reguł wstępnych, nie jako druga linia obrony w handlerze.</para>
/// </summary>
public sealed class IssueTransitionPermissionRule : IBatchRule<BatchTarget<IssueSetStateCommand>>
{
    private readonly IIssueQueries _issues;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IExecutionContext _executionContext;

    public IssueTransitionPermissionRule(
        IIssueQueries issues, IWorkflowSchemeRepository schemes, IExecutionContext executionContext)
    {
        _issues = issues;
        _schemes = schemes;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<BatchTarget<IssueSetStateCommand>> items,
        Func<BatchTarget<IssueSetStateCommand>, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        // Zgłoszenia poza dostępem wołającego pomijamy tutaj — istnienie i widoczność sprawdza
        // handler przy wykonaniu; ta reguła odpowiada wyłącznie na pytanie o uprawnienie
        // do KONKRETNEJ krawędzi, więc nieznaleziony cel po prostu jej nie dotyczy.
        var issueUuids = items.Select(item => item.AggregateUuid).Distinct().ToList();
        var issuesByUuid = (await _issues.GetAsync(issueUuids, cancellationToken).ConfigureAwait(false))
            .ToDictionary(issue => issue.Uuid);

        var schemeByProject = new Dictionary<Guid, WorkflowScheme?>();
        var granted = new HashSet<string>(_executionContext.Permissions, StringComparer.Ordinal);

        foreach (var item in items)
        {
            if (!issuesByUuid.TryGetValue(item.AggregateUuid, out var issue)
                || issue.StateUuid == item.Command.StateUuid)
            {
                // "Przejście w to samo miejsce" agregat pomija po cichu — nie ma krawędzi
                // do sprawdzenia.
                continue;
            }

            if (!schemeByProject.TryGetValue(issue.ProjectUuid, out var scheme))
            {
                scheme = await _schemes.FindByProjectAsync(issue.ProjectUuid, cancellationToken)
                    .ConfigureAwait(false);
                schemeByProject[issue.ProjectUuid] = scheme;
            }

            var transition = scheme?.Transitions.FirstOrDefault(candidate =>
                candidate.FromStateUuid == issue.StateUuid && candidate.ToStateUuid == item.Command.StateUuid);

            // Krawędź nieistniejąca w schemacie odpada w handlerze (`taskmgmt.transition_not_allowed`) —
            // ta reguła zajmuje się wyłącznie krawędziami, które ISTNIEJĄ i niosą wymóg.
            if (transition is { RequiredPermission.Length: > 0 } && !granted.Contains(transition.RequiredPermission))
            {
                tracker.AddError(
                    idSelector(item),
                    "taskmgmt.transition_forbidden",
                    $"Przejście wymaga uprawnienia '{transition.RequiredPermission}'.");
            }
        }
    }
}
