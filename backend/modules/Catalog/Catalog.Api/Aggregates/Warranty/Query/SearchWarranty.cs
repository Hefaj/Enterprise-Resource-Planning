using Catalog.Application.Contracts;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Warranty.Query;

/// <summary>Wyszukiwanie definicji gwarancji.</summary>
public sealed class SearchWarrantyEndpoint : Endpoint<SearchWarrantyRequest, SearchResponse>
{
    private readonly IWarrantyQueries _queries;

    public SearchWarrantyEndpoint(IWarrantyQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchWarranty");
        Group<WarrantyGroup>();
    }

    public override async Task HandleAsync(SearchWarrantyRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
