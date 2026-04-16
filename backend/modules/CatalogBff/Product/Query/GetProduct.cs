using FastEndpoints;

namespace CatalogBff.Product.Query;

public class GetProductRequest
{
    public List<Guid>? Uuids { get; set; }
}

public record ProductDto(Guid Uuid);

public class GetProductEndpoint : Endpoint<GetProductRequest, List<ProductDto>>
{
    public override void Configure()
    {
        Get("");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(GetProductRequest req, CancellationToken ct)
    {
        var list = new List<ProductDto>
        {
            new(Guid.NewGuid()),
            new(Guid.NewGuid()),
            new(Guid.NewGuid()),
            new(Guid.NewGuid()),
        };

        await Send.OkAsync(list);
    }
}
