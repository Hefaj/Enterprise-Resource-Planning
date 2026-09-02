using FastEndpoints;
using TaskManagement.Application.Resolutions;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Resolutions.Query;

/// <summary>Rozwiązania widoczne dla wybranego projektu (systemowe plus jego własne).</summary>
public sealed class SearchResolutionEndpoint : Endpoint<SearchResolutionRequest, List<ResolutionDto>>
{
    private readonly IResolutionQueries _queries;

    public SearchResolutionEndpoint(IResolutionQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchResolution");
        Group<ResolutionGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchResolutionRequest req, CancellationToken ct)
    {
        var resolutions = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(resolutions, ct);
    }
}
