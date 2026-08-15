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
}
