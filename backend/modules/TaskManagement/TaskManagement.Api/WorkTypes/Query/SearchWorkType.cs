using FastEndpoints;
using TaskManagement.Application.WorkTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.WorkTypes.Query;

/// <summary>Rodzaje pracy widoczne dla wybranego projektu (globalne plus jego własne),
/// wzorem <c>SearchTagEndpoint</c>.</summary>
public sealed class SearchWorkTypeEndpoint : Endpoint<SearchWorkTypeRequest, List<WorkTypeDto>>
{
    private readonly IWorkTypeQueries _queries;

    public SearchWorkTypeEndpoint(IWorkTypeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchWorkType");
        Group<WorkTypeGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchWorkTypeRequest req, CancellationToken ct)
    {
        var workTypes = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(workTypes, ct);
    }
}
