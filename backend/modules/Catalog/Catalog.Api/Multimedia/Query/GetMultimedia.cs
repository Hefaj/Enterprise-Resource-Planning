using Catalog.Application.Multimedia;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Query;

/// <summary>Pobranie multimediów po identyfikatorach.</summary>
public sealed class GetMultimediaEndpoint : Endpoint<GetMultimediaRequest, List<MultimediaDto>>
{
    private readonly IMultimediaQueries _queries;

    public GetMultimediaEndpoint(IMultimediaQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getMultimedia");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.DictionaryRead);
    }

    public override async Task HandleAsync(GetMultimediaRequest req, CancellationToken ct)
    {
        var items = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(items, ct);
    }
}
