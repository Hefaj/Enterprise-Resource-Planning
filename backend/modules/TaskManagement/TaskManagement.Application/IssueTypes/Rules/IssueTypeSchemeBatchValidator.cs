using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;

namespace TaskManagement.Application.IssueTypes;

/// <summary>
/// Wie, JAKIE reguły wsadowe obowiązują dla której operacji masowej na schematach typów.
/// Wzorzec identyczny jak <c>IssueBatchValidator</c> / <c>ProductBatchValidator</c> — „które
/// reguły stosujemy" jest decyzją przypadku użycia, nie transportu.
/// </summary>
public sealed class IssueTypeSchemeBatchValidator : IBatchValidator
{
    private readonly IssueTypeInUseRule _inUse;

    public IssueTypeSchemeBatchValidator(IssueTypeInUseRule inUse) => _inUse = inUse;

    /// <summary>Pre-check masowego usunięcia typów: żaden z celów nie może mieć zgłoszeń
    /// (TYP-004 AC1).</summary>
    public async Task<ValidationTracker> ValidateRemoveTypeAsync(
        IReadOnlyList<BatchTarget<IssueTypeSchemeRemoveTypeCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        await _inUse
            .ExecuteAsync(targets, t => t.AggregateUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }
}
