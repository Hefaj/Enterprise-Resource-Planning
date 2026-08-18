using Catalog.Application.Codes;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Codes.Query;

/// <summary>Wyszukiwanie typów kodów produktu.</summary>
public sealed class SearchCodeTypeEndpoint : Endpoint<SearchCodeTypeRequest, SearchResponse>
{
    private readonly ICodeTypeQueries _queries;

    public SearchCodeTypeEndpoint(ICodeTypeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchCodeType");
        Group<CodeTypeGroup>();
        Permissions(P.Catalog.DictionaryRead);
    }

    public override async Task HandleAsync(SearchCodeTypeRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
