using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Command;

/// <summary>Aktywuje sprinty planowane. Kolizja z drugim aktywnym sprintem tej samej tablicy
/// wraca jako <c>persistence_error</c> z naruszenia indeksu bazy (SPR-001 AC1).</summary>
public sealed class SprintExecStartMultipleCommandEndpoint
    : BatchEndpointBase<SprintExecStartCommand, SearchSprintRequest>
{
    private readonly ISprintQueries _queries;

    public SprintExecStartMultipleCommandEndpoint(ISprintQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-start");
        Group<SprintGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Aktywuje sprinty planowane"));
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
