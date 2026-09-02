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
    private readonly IssueParentCategoryRule _parentCategory;
    private readonly IssueLinkCycleRule _linkCycle;
    private readonly IssueTargetProjectMustExistRule _targetProjectMustExist;

    public IssueBatchValidator(
        IssueParentCycleRule parentCycle,
        IssueParentCategoryRule parentCategory,
        IssueLinkCycleRule linkCycle,
        IssueTargetProjectMustExistRule targetProjectMustExist)
    {
        _parentCycle = parentCycle;
        _parentCategory = parentCategory;
        _linkCycle = linkCycle;
        _targetProjectMustExist = targetProjectMustExist;
    }

    /// <summary>Pre-check masowej zmiany rodzica: żadna z krawędzi — ani osobno, ani łącznie
    /// z pozostałymi w tym samym wsadzie — nie może zamknąć pętli w drzewie, a kategoria typu
    /// (Epik/Podzadanie) musi dopuszczać taką hierarchię. Reguły są niezależne od siebie —
    /// płasko, nie łańcuchem — więc element może dostać oba naruszenia naraz
    /// (`docs/backend/batch-validation.md` §2 „Tryb niezależnych reguł").</summary>
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

        await _parentCategory
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

    /// <summary>Pre-check masowego przeniesienia projektu — jedna reguła: projekt docelowy musi
    /// istnieć. Reszta (typ zgłoszenia w schemacie docelowym, schemat pól) wymaga wczytania
    /// poszczególnych zgłoszeń i zostaje w handlerze jako druga linia obrony
    /// (`docs/backend/batch-validation.md`).</summary>
    public async Task<ValidationTracker> ValidateMoveToProjectAsync(
        IReadOnlyList<BatchTarget<IssueSetProjectCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var items = targets
            .Select(t => new IssueMoveToProjectTarget(t.AggregateUuid, t.Command.TargetProjectUuid))
            .ToList();

        await _targetProjectMustExist
            .ExecuteAsync(items, i => i.IssueUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }
}
