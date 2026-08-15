using Catalog.Application.Contracts;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.CodeType.Query;

/// <summary>Wyszukiwanie typów kodów produktu.</summary>
public sealed class SearchCodeTypeEndpoint : Endpoint<SearchCodeTypeRequest, SearchResponse>
{
    private readonly ICodeTypeQueries _queries;

    public SearchCodeTypeEndpoint(ICodeTypeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchCodeType");
        Group<CodeTypeGroup>();
    }

    public override async Task HandleAsync(SearchCodeTypeRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
