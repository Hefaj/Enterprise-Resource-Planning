using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Command;

public sealed class SprintCreateMultipleCommandEndpoint : CreateBatchEndpointBase<SprintCreateCommand, SearchSprintRequest>
{
    public override void Configure() { Post("batch-create"); Group<SprintGroup>(); Permissions(P.TaskManagement.BoardManage); }
}

public sealed class SprintStartMultipleCommandEndpoint : BatchEndpointBase<SprintStartCommand, SearchSprintRequest>
{
    private readonly ISprintQueries _queries;
    public SprintStartMultipleCommandEndpoint(ISprintQueries queries) => _queries = queries;
    public override void Configure() { Post("batch-start"); Group<SprintGroup>(); Permissions(P.TaskManagement.BoardManage); }
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchSprintRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct).ConfigureAwait(false);
}

public sealed class SprintCloseMultipleCommandEndpoint : BatchEndpointBase<SprintCloseCommand, SearchSprintRequest>
{
    private readonly ISprintQueries _queries;
    public SprintCloseMultipleCommandEndpoint(ISprintQueries queries) => _queries = queries;
    public override void Configure() { Post("batch-close"); Group<SprintGroup>(); Permissions(P.TaskManagement.BoardManage); }
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchSprintRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct).ConfigureAwait(false);
}

/// <summary>Dodaje zgłoszenia do sprintu albo przenosi je do backlogu.</summary>
public sealed class SprintSetIssueSprintMultipleCommandEndpoint
    : BatchEndpointBase<SprintSetIssueSprintCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;
    public SprintSetIssueSprintMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;
    public override void Configure() { Post("batch-set-issue-sprint"); Group<SprintGroup>(); Permissions(P.TaskManagement.IssueUpdate); }
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchIssueRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct).ConfigureAwait(false);
}
