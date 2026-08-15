using Catalog.Application.Warranties;
using FastEndpoints;

namespace Catalog.Warranties.Query;

/// <summary>Pobranie gwarancji po identyfikatorach.</summary>
public sealed class GetWarrantyEndpoint : Endpoint<GetWarrantyRequest, List<WarrantyDto>>
{
    private readonly IWarrantyQueries _queries;

    public GetWarrantyEndpoint(IWarrantyQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getWarranty");
        Group<WarrantyGroup>();
    }

    public override async Task HandleAsync(GetWarrantyRequest req, CancellationToken ct)
    {
        var items = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(items, ct);
    }
}
