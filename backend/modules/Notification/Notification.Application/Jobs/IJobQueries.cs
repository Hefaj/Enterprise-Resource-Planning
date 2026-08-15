using Erp.BuildingBlocks.Api.Contracts;

namespace Notification.Application.Jobs;

/// <summary>Odczyty repliki zadań. Implementacja w <c>Notification.Infrastructure</c>.</summary>
public interface IJobQueries
{
    Task<SearchResponse> SearchAsync(SearchJobRequest request, CancellationToken cancellationToken);

    Task<List<JobDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}
