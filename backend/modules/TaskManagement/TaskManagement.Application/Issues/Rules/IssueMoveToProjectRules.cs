using Erp.BuildingBlocks.Validation;
using TaskManagement.Application.Projects;

namespace TaskManagement.Application.Issues;

/// <summary>Cel przeniesienia: zgłoszenie i projekt, do którego ma trafić.</summary>
public sealed record IssueMoveToProjectTarget(Guid IssueUuid, Guid TargetProjectUuid);

/// <summary>
/// Reguła wsadowa: projekt docelowy musi istnieć — pre-check zamiast N razy tego samego
/// <c>AggregateNotFoundException</c> z handlera, gdy użytkownik wskaże skasowany albo
/// nieistniejący projekt (BULK-001 AC2: cały wsad odpada tanio, jednym zapytaniem, zanim
/// powstanie zadanie).
/// </summary>
public sealed class IssueTargetProjectMustExistRule : IBatchRule<IssueMoveToProjectTarget>
{
    private readonly IProjectQueries _projects;

    public IssueTargetProjectMustExistRule(IProjectQueries projects) => _projects = projects;

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<IssueMoveToProjectTarget> items,
        Func<IssueMoveToProjectTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        var targetProjectUuids = items.Select(i => i.TargetProjectUuid).Distinct().ToList();
        var existing = new HashSet<Guid>(
            (await _projects.GetAsync(targetProjectUuids, cancellationToken).ConfigureAwait(false))
            .Select(p => p.Uuid));

        foreach (var item in items)
        {
            if (!existing.Contains(item.TargetProjectUuid))
            {
                tracker.AddError(
                    idSelector(item),
                    "taskmgmt.project_not_found",
                    $"Nie znaleziono projektu docelowego o identyfikatorze {item.TargetProjectUuid}.");
            }
        }
    }
}
