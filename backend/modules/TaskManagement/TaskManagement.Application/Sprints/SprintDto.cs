using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Domain.Sprints;

namespace TaskManagement.Application.Sprints;

public sealed record SprintDto(Guid Uuid, Guid BoardUuid, string Name, DateOnly StartOn, DateOnly EndOn, SprintStatus Status);

public sealed class SearchSprintRequest : PagedRequest
{
    public Guid? BoardUuid { get; set; }
}

public sealed class GetSprintRequest
{
    public List<Guid>? Uuids { get; set; }
}

public interface ISprintQueries
{
    Task<SearchResponse> SearchAsync(SearchSprintRequest request, CancellationToken cancellationToken);
    Task<List<SprintDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
    Task<List<Guid>> GetMatchingUuidsAsync(SearchSprintRequest request, CancellationToken cancellationToken);
}
