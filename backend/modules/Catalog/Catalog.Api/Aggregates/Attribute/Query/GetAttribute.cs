using Catalog.Application.Contracts;
using FastEndpoints;

namespace Catalog.Attribute.Query;

/// <summary>Pobranie definicji atrybutów po identyfikatorach.</summary>
public sealed class GetAttributeEndpoint : Endpoint<GetAttributeRequest, List<AttributeDefinitionDto>>
{
    private readonly IAttributeQueries _queries;

    public GetAttributeEndpoint(IAttributeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getAttribute");
        Group<AttributeGroup>();
    }

    public override async Task HandleAsync(GetAttributeRequest req, CancellationToken ct)
    {
        var items = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(items, ct);
    }
}
