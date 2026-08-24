using Catalog.Application.ExportRuns;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ExportRuns.Query;

/// <summary>Pobranie przebiegów po identyfikatorach — druga połowa kontraktu „szukaj → pobierz”.</summary>
public sealed class GetExportRunEndpoint : Endpoint<GetExportRunRequest, List<ExportRunDto>>
{
    private readonly IExportRunQueries _queries;

    public GetExportRunEndpoint(IExportRunQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getExportRun");
        Group<ExportRunGroup>();
        Permissions(P.Catalog.ExportRunCreate);
    }

    public override async Task HandleAsync(GetExportRunRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.GetAsync(req.Uuids, ct), ct);
}
