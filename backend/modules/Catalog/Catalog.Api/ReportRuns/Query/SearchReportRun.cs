using Catalog.Application.ReportRuns;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ReportRuns.Query;

/// <summary>Wyszukiwanie przebiegów raportu — zwraca identyfikatory i licznik.</summary>
public sealed class SearchReportRunEndpoint : Endpoint<SearchReportRunRequest, SearchResponse>
{
    private readonly IReportRunQueries _queries;

    public SearchReportRunEndpoint(IReportRunQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchReportRun");
        Group<ReportRunGroup>();
        Permissions(P.Catalog.ReportRunCreate);
    }

    public override async Task HandleAsync(SearchReportRunRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.SearchAsync(req, ct), ct);
}
