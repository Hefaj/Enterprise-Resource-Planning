using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Reports;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Reports.Query;

/// <summary>Wyszukiwanie przebiegów raportu — zwraca identyfikatory i licznik.</summary>
public sealed class SearchReportRunEndpoint : Endpoint<SearchReportRunRequest, SearchResponse>
{
    private readonly IReportRunQueries _queries;

    public SearchReportRunEndpoint(IReportRunQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchReportRun");
        Group<ReportRunGroup>();
        Permissions(P.TaskManagement.ReportReadAll);
    }

    public override async Task HandleAsync(SearchReportRunRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.SearchAsync(req, ct), ct);
}
