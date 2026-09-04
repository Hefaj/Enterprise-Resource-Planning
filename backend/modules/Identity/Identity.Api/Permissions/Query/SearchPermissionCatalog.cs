using FastEndpoints;
using Identity.Application.Permissions;

namespace Identity.Permissions.Query;

/// <summary>Read-only przeglądarka katalogu uprawnień — patrz
/// <c>docs/architecture/security.md</c> §3. Brak paginacji celowo: katalog ma dziesiątki,
/// nie tysiące wpisów, więc UI (grupowanie po module) woli mieć wszystko naraz.</summary>
public sealed class SearchPermissionCatalogEndpoint : EndpointWithoutRequest<List<PermissionCatalogEntryDto>>
{
    private readonly IPermissionCatalogQueries _queries;

    public SearchPermissionCatalogEndpoint(IPermissionCatalogQueries queries) => _queries = queries;

    public override void Configure()
    {
        Get("catalog");
        Group<PermissionGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var entries = await _queries.GetAllAsync(ct);
        await Send.OkAsync(entries, ct);
    }
}
