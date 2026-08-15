using Catalog.Application.Contracts;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Model.Query;

/// <summary>Wyszukiwanie modeli produktów.</summary>
public sealed class SearchModelEndpoint : Endpoint<SearchModelRequest, SearchResponse>
{
    private readonly IModelQueries _queries;

    public SearchModelEndpoint(IModelQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchModel");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(SearchModelRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
