using Erp.BuildingBlocks.Api.Contracts;

namespace Identity.Application.Roles;

/// <summary>Rola w widoku odczytu.</summary>
public sealed record RoleDto(
    Guid Uuid,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<Guid> MemberRoleUuids);

/// <summary>Filtry wyszukiwania ról.</summary>
public sealed class SearchRoleRequest : PagedRequest
{
    public string? Name { get; set; }
}

/// <summary>Pobranie ról po identyfikatorach.</summary>
public sealed class GetRoleRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Krawędź grafu ról: <see cref="ContainerUuid"/> zawiera <see cref="MemberUuid"/> jako
/// składową — jeden wiersz tabeli <c>role_member</c>. Zasila <c>RoleGraphCycleRule</c>, która
/// buduje z całego zbioru krawędzi graf w pamięci, żeby wykryć cykl WEWNĄTRZ wsadu (patrz
/// uzasadnienie w <c>docs/backend/identity-bulk-migration.md</c> §1.3).</summary>
public sealed record RoleMembershipEdge(Guid ContainerUuid, Guid MemberUuid);

/// <summary>Odczyty ról. Implementacja w <c>Identity.Infrastructure</c>.</summary>
public interface IRoleQueries
{
    Task<SearchResponse> SearchAsync(SearchRoleRequest request, CancellationToken cancellationToken);

    Task<List<RoleDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>Identyfikatory ról pasujących do filtra, bez stronicowania — używane przez
    /// operacje masowe do wyznaczenia zbioru celów (tryb szablon+filtr
    /// <c>BatchEndpointBase</c>).</summary>
    Task<List<Guid>> GetMatchingUuidsAsync(SearchRoleRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Spośród podanych identyfikatorów zwraca te, które faktycznie istnieją jako role.
    ///
    /// Jedno zbiorcze zapytanie zamiast N osobnych <c>FindAsync</c> — używane m.in. przez
    /// <c>ReferencedRoleMustExistRule</c> (czy rola wskazana w <c>UserAssignRoleCommand</c>
    /// istnieje), zanim <c>BulkCommandRunner</c> w ogóle zacznie przetwarzać element.
    /// </summary>
    Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);

    /// <summary>
    /// Spośród podanych kodów zwraca te, które JUŻ istnieją w bazie — porównanie po formie
    /// znormalizowanej (<c>Role.ValidateCode</c>: przycięte, małymi literami), bo tak role
    /// przechowują <c>Code</c>. Używane przez <c>RoleCodeUniqueRule</c> przy masowym tworzeniu
    /// ról — jedno zapytanie zamiast N wywołań <c>IRoleRepository.FindByCodeAsync</c>.
    /// </summary>
    Task<List<string>> GetExistingCodesAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken);

    /// <summary>
    /// Wszystkie krawędzie <c>role_member</c> w systemie — jedno zapytanie, z którego
    /// <c>RoleGraphCycleRule</c> buduje graf w pamięci. Tabela ról liczy dziesiątki, nie
    /// tysiące wierszy (patrz <c>docs/backend/identity-authz.md</c> §2 „bez tabeli domknięcia
    /// w v1"), więc materializacja całego grafu jest tania.
    /// </summary>
    Task<List<RoleMembershipEdge>> GetAllMembershipEdgesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Czy <paramref name="ancestorRoleUuid"/> już transitywnie zawiera
    /// <paramref name="roleUuid"/> jako składową (bezpośrednio lub przez łańcuch <c>role_member</c>).
    ///
    /// Wołane PRZED <c>Role.AddMember</c> — jeśli wynik jest prawdziwy, dodanie
    /// <paramref name="ancestorRoleUuid"/> jako składowej kontenera <paramref name="roleUuid"/>
    /// zamknęłoby cykl (patrz <c>docs/backend/identity-authz.md</c> §2). Agregat sam nie ma
    /// jak tego sprawdzić — nie ma dostępu do bazy.
    /// </summary>
    Task<bool> IsDescendantAsync(Guid ancestorRoleUuid, Guid roleUuid, CancellationToken cancellationToken);
}
