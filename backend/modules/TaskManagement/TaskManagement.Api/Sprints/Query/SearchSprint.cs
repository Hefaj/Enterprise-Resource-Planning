using FastEndpoints;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Query;

/// <summary>Sprinty widoczne dla użytkownika, opcjonalnie zawężone do tablicy i statusu.</summary>
public sealed class SearchSprintEndpoint : Endpoint<SearchSprintRequest, List<SprintDto>>
{
    private readonly ISprintQueries _queries;

    public SearchSprintEndpoint(ISprintQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchSprint");
        Group<SprintGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchSprintRequest req, CancellationToken ct)
    {
        var sprints = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(sprints, ct);
    }
}
