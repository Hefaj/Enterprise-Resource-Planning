using FastEndpoints;
using TaskManagement.Application.Tags;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Tags.Query;

/// <summary>Tagi widoczne dla wybranego projektu (globalne plus jego własne).</summary>
public sealed class SearchTagEndpoint : Endpoint<SearchTagRequest, List<TagDto>>
{
    private readonly ITagQueries _queries;

    public SearchTagEndpoint(ITagQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchTag");
        Group<TagGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchTagRequest req, CancellationToken ct)
    {
        var tags = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(tags, ct);
    }
}
