using FastEndpoints;
using Identity.Application.Audit;
using Erp.BuildingBlocks.Api.Contracts;

namespace Identity.Audit.Query;

/// <summary>Wyszukiwanie wpisów dziennika audytowego — ten sam wzorzec „szukaj → pobierz"
/// co <c>SearchRoleEndpoint</c>/<c>SearchUserEndpoint</c>. Ungated dziś (patrz
/// <c>docs/architecture/security.md</c> Faza 6) — read-only, tak samo jak <c>GetRole</c>/<c>GetUser</c>.</summary>
public sealed class SearchGrantAuditEndpoint : Endpoint<SearchGrantAuditRequest, SearchResponse>
{
    private readonly IGrantAuditQueries _queries;

    public SearchGrantAuditEndpoint(IGrantAuditQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("search");
        Group<AuditGroup>();
    }

    public override async Task HandleAsync(SearchGrantAuditRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
