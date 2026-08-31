using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using TaskManagement.Application.Abstractions;

namespace TaskManagement.Application.IssueTypes;

/// <summary>
/// Reguła wsadowa: cel <c>batch-remove-type</c> nie może być typem, który ma choć jedno
/// zgłoszenie (TYP-004 AC1).
///
/// <para>Jedno zapytanie per typ w wsadzie, nie per zgłoszenie — <see cref="IIssueTypeUsageProbe"/>
/// liczy wiersze <c>issue</c>, więc dla wsadu kilkunastu typów to kilkanaście tanich zapytań
/// agregujących, nie skan wszystkich zgłoszeń modułu. Komunikat niesie liczbę zgłoszeń, nie
/// ogólny błąd — użytkownik wie, ile pracy trzeba przenieść na inny typ przed usunięciem.</para>
/// </summary>
public sealed class IssueTypeInUseRule : IBatchRule<BatchTarget<IssueTypeSchemeRemoveTypeCommand>>
{
    private readonly IIssueTypeUsageProbe _usage;

    public IssueTypeInUseRule(IIssueTypeUsageProbe usage) => _usage = usage;

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<BatchTarget<IssueTypeSchemeRemoveTypeCommand>> items,
        Func<BatchTarget<IssueTypeSchemeRemoveTypeCommand>, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(idSelector);
        ArgumentNullException.ThrowIfNull(tracker);

        foreach (var item in items)
        {
            var count = await _usage.CountByTypeAsync(item.Command.TypeUuid, cancellationToken).ConfigureAwait(false);

            if (count > 0)
            {
                tracker.AddError(
                    idSelector(item),
                    "taskmgmt.issue_type_in_use",
                    $"Typ jest użyty na {count} zgłoszeniach — usunięcie jest niemożliwe.");
            }
        }
    }
}
