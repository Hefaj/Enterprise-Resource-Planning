using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Query;

/// <summary>Wyszukiwanie projektów. Uprawnienie to ODCZYT zgłoszeń, nie zarządzanie projektami —
/// przełącznik kontekstu projektu na liście zgłoszeń potrzebuje tej listy, a ma go widzieć
/// każdy członek zespołu.</summary>
public sealed class SearchProjectEndpoint : Endpoint<SearchProjectRequest, SearchResponse>
{
    private readonly IProjectQueries _queries;

    public SearchProjectEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchProject");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchProjectRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
