using FastEndpoints;
using TaskManagement.Application.FieldSchemes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.FieldSchemes.Query;

/// <summary>Schematy pól razem z definicjami — ekran konfiguracji projektu.</summary>
public sealed class SearchFieldSchemeEndpoint : Endpoint<SearchFieldSchemeRequest, List<FieldSchemeDto>>
{
    private readonly IFieldSchemeQueries _queries;

    public SearchFieldSchemeEndpoint(IFieldSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchFieldScheme");
        Group<FieldSchemeGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchFieldSchemeRequest req, CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(schemes, ct);
    }
}
