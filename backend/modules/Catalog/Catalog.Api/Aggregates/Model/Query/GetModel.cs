using Catalog.Application.Contracts;
using FastEndpoints;

namespace Catalog.Model.Query;

/// <summary>Pobranie modeli po identyfikatorach.</summary>
public sealed class GetModelEndpoint : Endpoint<GetModelRequest, List<ModelDto>>
{
    private readonly IModelQueries _queries;

    public GetModelEndpoint(IModelQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getModel");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(GetModelRequest req, CancellationToken ct)
    {
        var items = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(items, ct);
    }
}
