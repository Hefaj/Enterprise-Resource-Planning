using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Notification.Application.Contracts;

namespace Notification.Job.Query;

/// <summary>Wyszukiwanie zadań w replice — zwraca identyfikatory i licznik, zgodnie
/// z tym samym wzorcem „szukaj → pobierz”, co pozostałe moduły.</summary>
public sealed class SearchJobEndpoint : Endpoint<SearchJobRequest, SearchResponse>
{
    private readonly IJobQueries _queries;

    public SearchJobEndpoint(IJobQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(SearchJobRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
