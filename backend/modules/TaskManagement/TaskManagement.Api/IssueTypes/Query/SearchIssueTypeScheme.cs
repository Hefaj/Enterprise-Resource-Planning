using FastEndpoints;
using TaskManagement.Application.IssueTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.IssueTypes.Query;

/// <summary>Schematy typów razem z typami — ekran konfiguracji projektu i modal tworzenia zgłoszenia.</summary>
public sealed class SearchIssueTypeSchemeEndpoint : Endpoint<SearchIssueTypeSchemeRequest, List<IssueTypeSchemeDto>>
{
    private readonly IIssueTypeSchemeQueries _queries;

    public SearchIssueTypeSchemeEndpoint(IIssueTypeSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchIssueTypeScheme");
        Group<IssueTypeGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchIssueTypeSchemeRequest req, CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(schemes, ct);
    }
}
