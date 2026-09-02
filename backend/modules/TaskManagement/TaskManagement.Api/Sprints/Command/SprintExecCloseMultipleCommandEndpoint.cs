using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Command;

/// <summary>
/// Zamyka sprinty. <c>MoveUnfinishedToSprintUuid</c> jest jawną decyzją, dokąd trafiają
/// niedokończone zgłoszenia — <c>null</c> to backlog, uuid to następny sprint (SPR-003 AC1).
/// </summary>
public sealed class SprintExecCloseMultipleCommandEndpoint
    : BatchEndpointBase<SprintExecCloseCommand, SearchSprintRequest>
{
    private readonly ISprintQueries _queries;

    public SprintExecCloseMultipleCommandEndpoint(ISprintQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-close");
        Group<SprintGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Zamyka sprinty — niedokończone zgłoszenia trafiają do backlogu albo do wskazanego sprintu"));
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
