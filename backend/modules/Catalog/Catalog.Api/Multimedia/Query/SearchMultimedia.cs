using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Multimedia.Query;

/// <summary>Wyszukiwanie zasobów multimedialnych.</summary>
public sealed class SearchMultimediaEndpoint : Endpoint<SearchMultimediaRequest, SearchResponse>
{
    private readonly IMultimediaQueries _queries;

    public SearchMultimediaEndpoint(IMultimediaQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchMultimedia");
        Group<MultimediaGroup>();
    }

    public override async Task HandleAsync(SearchMultimediaRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
