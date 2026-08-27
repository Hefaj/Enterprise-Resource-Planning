using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>Wyszukiwanie zgłoszeń — zwraca identyfikatory i licznik, wzorzec „szukaj → pobierz”
/// wspólny dla wszystkich modułów. Widoczność liczy się po projekcie w zapytaniu, nie tutaj:
/// endpoint nie ma jak jej pominąć.</summary>
public sealed class SearchIssueEndpoint : Endpoint<SearchIssueRequest, SearchResponse>
{
    private readonly IIssueQueries _queries;

    public SearchIssueEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchIssue");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchIssueRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
