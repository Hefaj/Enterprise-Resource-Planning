using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Internal;

/// <summary>Identyfikator w trasie — dedykowany typ żądania, bo <c>GetUserAccountRequest</c>
/// niesie listę identyfikatorów (POST), a to jest GET z jednym id w ścieżce.</summary>
public sealed class GetUserPermissionsRequest
{
    public Guid Id { get; set; }
}

/// <summary>
/// Konsumowane przez inne mikroserwisy (Catalog, Sales, Notification) do budowy cache'u
/// uprawnień — patrz <c>docs/backend/identity-authz.md</c> §4 (<c>IPermissionProvider</c>,
/// Faza 3). Nazwa zaczyna się od <c>/internal</c> celowo: to jest wywołanie serwis-do-serwisu,
/// nie coś, co front miałby kiedykolwiek wołać bezpośrednio.
///
/// <para><b>Znany dług, świadomie odłożony do Fazy 3.</b> Dziś ten endpoint wymaga wyłącznie
/// ważnego tokenu JWT (jak każdy inny) — DOWOLNY zalogowany użytkownik może dziś odpytać
/// o uprawnienia DOWOLNEGO innego użytkownika, podmieniając <c>Id</c> w ścieżce. Docelowo
/// potrzebuje osobnej polityki autoryzacji ograniczonej do kont serwisowych (client credentials
/// z Keycloaka albo sieciowa izolacja) — nie do wystawienia poza siecią wewnętrzną bez tego.</para>
/// </summary>
public sealed class GetUserPermissionsEndpoint : Endpoint<GetUserPermissionsRequest, List<string>>
{
    private readonly IUserAccountQueries _queries;

    public GetUserPermissionsEndpoint(IUserAccountQueries queries) => _queries = queries;

    public override void Configure()
    {
        Get("/internal/users/{Id}/permissions");
    }

    public override async Task HandleAsync(GetUserPermissionsRequest req, CancellationToken ct)
    {
        var codes = await _queries.GetEffectivePermissionCodesAsync(req.Id, ct);
        await Send.OkAsync(codes.ToList(), ct);
    }
}
