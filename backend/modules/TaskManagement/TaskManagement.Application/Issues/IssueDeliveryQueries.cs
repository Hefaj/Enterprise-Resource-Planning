namespace TaskManagement.Application.Issues;

/// <summary>
/// Odczyty potrzebne do przeliczenia <c>Issue.DerivedDeliveryState</c> (REQ-003) —
/// wyłącznie po krawędziach <see cref="Domain.Issues.IssueLinkType.Delivers"/>, gdzie źródło
/// jest realizacją, a cel zleceniem.
/// </summary>
public interface IIssueDeliveryQueries
{
    /// <summary>Zlecenie, które realizuje wskazane zgłoszenie wykonawcze — <c>null</c>, gdy
    /// zgłoszenie nie realizuje żadnego zlecenia.</summary>
    Task<Guid?> FindRequestForExecutionAsync(Guid executionIssueUuid, CancellationToken cancellationToken);

    /// <summary>Czy WSZYSTKIE zgłoszenia realizujące wskazane zlecenie mają kategorię stanu
    /// <c>Done</c>. Zlecenie bez żadnej realizacji zwraca <c>false</c> — „brak realizacji"
    /// nie jest „wszystkie zrealizowane”.</summary>
    Task<bool> AllDeliveriesClosedAsync(Guid requestIssueUuid, CancellationToken cancellationToken);
}
