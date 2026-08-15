using Erp.BuildingBlocks.Api.Contracts;

namespace Notification.Application.Jobs;

/// <summary>Pobranie zadań po identyfikatorach.</summary>
public sealed class GetJobRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Filtry wyszukiwania zadań.</summary>
public sealed class SearchJobRequest : PagedRequest
{
    public string? QueueId { get; set; }

    public string? TrackingId { get; set; }

    public bool? IsComplete { get; set; }

    public string? UserId { get; set; }

    /// <summary>
    /// Karta przeglądarki, która zleciła zadanie. Dopóki nie ma uwierzytelniania, to po nim
    /// feed powiadomień odsiewa „moje zadania” od cudzych — patrz udokumentowane ograniczenie
    /// w <c>SyncHub</c>. Filtr dokładny, nie ILIKE: clientId jest GUID-em generowanym przez
    /// klienta, więc wyszukiwanie częściowe nie miałoby tu sensu.
    /// </summary>
    public string? ClientId { get; set; }
}
