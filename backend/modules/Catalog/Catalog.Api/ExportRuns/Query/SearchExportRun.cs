using Catalog.Application.ExportRuns;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ExportRuns.Query;

/// <summary>Wyszukiwanie przebiegów eksportu — zwraca identyfikatory i licznik.</summary>
public sealed class SearchExportRunEndpoint : Endpoint<SearchExportRunRequest, SearchResponse>
{
    private readonly IExportRunQueries _queries;

    public SearchExportRunEndpoint(IExportRunQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchExportRun");
        Group<ExportRunGroup>();
        Permissions(P.Catalog.ExportRunCreate);
    }

    public override async Task HandleAsync(SearchExportRunRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.SearchAsync(req, ct), ct);
}
