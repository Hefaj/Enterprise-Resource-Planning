using Catalog.Application.Attributes;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Attributes.Query;

/// <summary>Wyszukiwanie definicji atrybutów produktu.</summary>
public sealed class SearchAttributeEndpoint : Endpoint<SearchAttributeRequest, SearchResponse>
{
    private readonly IAttributeQueries _queries;

    public SearchAttributeEndpoint(IAttributeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchAttribute");
        Group<AttributeGroup>();
        Permissions(P.Catalog.DictionaryRead);
    }

    public override async Task HandleAsync(SearchAttributeRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
