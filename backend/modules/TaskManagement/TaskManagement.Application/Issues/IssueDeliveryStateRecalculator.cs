using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Przelicza <see cref="Issue.DerivedDeliveryState"/> zlecenia i zapisuje wynik na agregacie —
/// współdzielone przez dwie ścieżki wywołania (REQ-003):
/// <see cref="IssueClosedRecalculateDeliveryStateHandler"/> (zamknięcie realizacji) i
/// <c>IssueAddLinkCommandHandler</c>/<c>IssueRemoveLinkCommandHandler</c> (dopięcie/odpięcie
/// krawędzi <see cref="IssueLinkType.Delivers"/> zmienia zbiór realizacji, więc też wymaga
/// przeliczenia — nie tylko zamknięcie jednej z nich).
/// </summary>
public sealed class IssueDeliveryStateRecalculator
{
    private readonly IIssueDeliveryQueries _deliveryQueries;
    private readonly IIssueRepository _issues;
    private readonly IssueNotificationPublisher _notifications;

    public IssueDeliveryStateRecalculator(
        IIssueDeliveryQueries deliveryQueries, IIssueRepository issues, IssueNotificationPublisher notifications)
    {
        _deliveryQueries = deliveryQueries;
        _issues = issues;
        _notifications = notifications;
    }

    public async Task RecalculateAsync(Guid requestIssueUuid, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var request = await _issues.FindAsync(requestIssueUuid, cancellationToken).ConfigureAwait(false);

        if (request is null)
        {
            return;
        }

        var previous = request.DerivedDeliveryState;

        var allClosed = await _deliveryQueries
            .AllDeliveriesClosedAsync(requestIssueUuid, cancellationToken)
            .ConfigureAwait(false);

        var next = allClosed ? IssueDeliveryState.Delivered : IssueDeliveryState.InProgress;
        request.SetDerivedDeliveryState(next, now);

        if (previous != IssueDeliveryState.Delivered && next == IssueDeliveryState.Delivered)
        {
            await _notifications
                .PublishRequestDeliveredAsync(request, now, Guid.CreateVersion7(), cancellationToken)
                .ConfigureAwait(false);
        }
    }
}
