using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Command;

/// <summary>Seryjne nadpisanie zakresu dat i celu sprintu.</summary>
public sealed class SprintSetDatesMultipleCommandEndpoint
    : BatchEndpointBase<SprintSetDatesCommand, SearchSprintRequest>
{
    private readonly ISprintQueries _queries;

    public SprintSetDatesMultipleCommandEndpoint(ISprintQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-dates");
        Group<SprintGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Seryjne nadpisanie zakresu dat i celu sprintu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchSprintRequest filter,
        CancellationToken ct)
    {
        var sprints = await _queries.SearchAsync(filter, ct);

        return sprints.Select(s => s.Uuid);
    }
}
