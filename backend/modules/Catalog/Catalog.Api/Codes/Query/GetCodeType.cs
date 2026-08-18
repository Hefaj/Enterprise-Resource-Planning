using Catalog.Application.Codes;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Codes.Query;

/// <summary>Pobranie typów kodów po identyfikatorach.</summary>
public sealed class GetCodeTypeEndpoint : Endpoint<GetCodeTypeRequest, List<CodeTypeDto>>
{
    private readonly ICodeTypeQueries _queries;

    public GetCodeTypeEndpoint(ICodeTypeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getCodeType");
        Group<CodeTypeGroup>();
        Permissions(P.Catalog.DictionaryRead);
    }

    public override async Task HandleAsync(GetCodeTypeRequest req, CancellationToken ct)
    {
        var items = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(items, ct);
    }
}
