using FastEndpoints;

namespace CatalogBff.Model.Query;

public class GetModelRequest
{
    public List<Guid>? Uuids { get; set; }
}

public record ModelDto(Guid Uuid);

public class GetModelEndpoint : Endpoint<GetModelRequest, List<ModelDto>>
{
    public override void Configure()
    {
        Get("");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(GetModelRequest req, CancellationToken ct)
    {
        var list = new List<ModelDto>
        {
            new(Guid.NewGuid()),
            new(Guid.NewGuid()),
            new(Guid.NewGuid()),
        };

        await Send.OkAsync(list);
    }
}
