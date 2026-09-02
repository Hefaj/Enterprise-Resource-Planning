using FastEndpoints;
using TaskManagement.Application.Reports;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Reports.Query;

/// <summary>Pobranie przebiegów po identyfikatorach — druga połowa kontraktu „szukaj → pobierz”.</summary>
public sealed class GetReportRunEndpoint : Endpoint<GetReportRunRequest, List<ReportRunDto>>
{
    private readonly IReportRunQueries _queries;

    public GetReportRunEndpoint(IReportRunQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getReportRun");
        Group<ReportRunGroup>();
        Permissions(P.TaskManagement.ReportReadAll);
    }

    public override async Task HandleAsync(GetReportRunRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.GetAsync(req.Uuids, ct), ct);
}
