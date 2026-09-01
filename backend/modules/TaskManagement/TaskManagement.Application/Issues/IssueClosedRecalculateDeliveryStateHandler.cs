using Erp.BuildingBlocks.Application.Abstractions;
using TaskManagement.Domain.Issues.Events;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Zamknięcie zgłoszenia wykonawczego przelicza <c>DerivedDeliveryState</c> zlecenia, które
/// realizuje (REQ-003) — w tej samej transakcji, bez opuszczania modułu
/// (<see cref="IssueClosed"/> jest zdarzeniem domenowym, nie integracyjnym).
///
/// <para>Zlecenie <b>nie zamyka się samo</b>: ten handler tylko przestawia wskaźnik na
/// <c>Delivered</c>, gdy wszystkie realizacje są zamknięte — zamknięcie zlecenia zostaje
/// zawsze osobną decyzją człowieka (odbiór).</para>
/// </summary>
public sealed class IssueClosedRecalculateDeliveryStateHandler : IDomainEventListener<IssueClosed>
{
    private readonly IIssueDeliveryQueries _deliveryQueries;
    private readonly IssueDeliveryStateRecalculator _recalculator;
    private readonly IClock _clock;

    public IssueClosedRecalculateDeliveryStateHandler(
        IIssueDeliveryQueries deliveryQueries,
        IssueDeliveryStateRecalculator recalculator,
        IClock clock)
    {
        _deliveryQueries = deliveryQueries;
        _recalculator = recalculator;
        _clock = clock;
    }

    public async Task HandleAsync(IssueClosed domainEvent, CancellationToken cancellationToken)
    {
        var requestUuid = await _deliveryQueries
            .FindRequestForExecutionAsync(domainEvent.IssueUuid, cancellationToken)
            .ConfigureAwait(false);

        if (requestUuid is null)
        {
            return;
        }

        await _recalculator
            .RecalculateAsync(requestUuid.Value, _clock.UtcNow, cancellationToken)
            .ConfigureAwait(false);
    }
}
