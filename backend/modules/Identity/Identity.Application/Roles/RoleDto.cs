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

/// <summary>Odczyty ról. Implementacja w <c>Identity.Infrastructure</c>.</summary>
public interface IRoleQueries
{
    Task<SearchResponse> SearchAsync(SearchRoleRequest request, CancellationToken cancellationToken);

    Task<List<RoleDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>
    /// Spośród podanych identyfikatorów zwraca te, które faktycznie istnieją jako role.
    ///
    /// Jedno zbiorcze zapytanie zamiast N osobnych <c>FindAsync</c> — używane m.in. przez
    /// <c>ReferencedRoleMustExistRule</c> (czy rola wskazana w <c>UserAssignRoleCommand</c>
    /// istnieje), zanim <c>BulkCommandRunner</c> w ogóle zacznie przetwarzać element.
    /// </summary>
    Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);

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
