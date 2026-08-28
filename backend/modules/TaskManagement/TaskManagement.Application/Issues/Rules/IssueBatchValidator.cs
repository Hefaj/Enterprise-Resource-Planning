using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Wie, JAKIE reguły wsadowe obowiązują dla której operacji masowej na zgłoszeniach.
///
/// <para><b>Dlaczego w Application, a nie w endpoincie</b> — ten sam powód, co w Catalogu
/// i Identity: „które reguły biznesowe stosujemy" to decyzja przypadku użycia, nie transportu.
/// Endpoint zna tylko swoją komendę i deleguje.</para>
/// </summary>
public sealed class IssueBatchValidator : IBatchValidator
{
    private readonly IssueParentCycleRule _parentCycle;
    private readonly IssueLinkCycleRule _linkCycle;

    public IssueBatchValidator(IssueParentCycleRule parentCycle, IssueLinkCycleRule linkCycle)
    {
        _parentCycle = parentCycle;
        _linkCycle = linkCycle;
    }

    /// <summary>Pre-check masowej zmiany rodzica: żadna z krawędzi — ani osobno, ani łącznie
    /// z pozostałymi w tym samym wsadzie — nie może zamknąć pętli w drzewie.</summary>
    public async Task<ValidationTracker> ValidateSetParentAsync(
        IReadOnlyList<BatchTarget<IssueSetParentCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var items = targets
            .Select(t => new IssueParentTarget(t.AggregateUuid, t.Command.ParentUuid))
            .ToList();

        await _parentCycle
            .ExecuteAsync(items, i => i.IssueUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }

    /// <summary>Pre-check masowego dopinania powiązań — sprawdzane są wyłącznie blokady,
    /// bo tylko one muszą być acykliczne (<c>docs/backend/task-management.md</c> §8.2).</summary>
    public async Task<ValidationTracker> ValidateAddLinkAsync(
        IReadOnlyList<BatchTarget<IssueAddLinkCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var items = targets
            .Select(t => new IssueLinkTarget(t.AggregateUuid, t.Command.TargetUuid, t.Command.Type))
            .ToList();

        await _linkCycle
            .ExecuteAsync(items, i => i.SourceUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }
}
