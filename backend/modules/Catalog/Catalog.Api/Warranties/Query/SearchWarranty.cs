using Catalog.Application.Warranties;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Warranties.Query;

/// <summary>Wyszukiwanie definicji gwarancji.</summary>
public sealed class SearchWarrantyEndpoint : Endpoint<SearchWarrantyRequest, SearchResponse>
{
    private readonly IWarrantyQueries _queries;

    public SearchWarrantyEndpoint(IWarrantyQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchWarranty");
        Group<WarrantyGroup>();
        Permissions(P.Catalog.DictionaryRead);
    }

    public override async Task HandleAsync(SearchWarrantyRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
