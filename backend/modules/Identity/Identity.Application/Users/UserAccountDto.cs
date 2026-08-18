using Erp.BuildingBlocks.Api.Contracts;

namespace Identity.Application.Users;

/// <summary>Użytkownik w widoku odczytu.</summary>
public sealed record UserAccountDto(
    Guid Uuid,
    string Email,
    string DisplayName,
    bool IsActive,
    IReadOnlyList<UserRoleGrantDto> RoleGrants,
    IReadOnlyList<UserPermissionGrantDto> PermissionGrants);

public sealed record UserRoleGrantDto(Guid RoleUuid, DateTimeOffset GrantedAt, string? GrantedBy, DateTimeOffset? ExpiresAt);

public sealed record UserPermissionGrantDto(
    string PermissionCode, DateTimeOffset GrantedAt, string? GrantedBy, string Reason);

/// <summary>
/// Jeden wpis efektywnego zbioru uprawnień z rozwinięciem "skąd" — bez tego zagnieżdżone role
/// są niediagnozowalne po kilku miesiącach (patrz <c>docs/backend/identity-authz.md</c> §6).
/// Jedno uprawnienie może mieć kilka źródeł (dwie różne role dają to samo uprawnienie) —
/// dlatego lista, nie pojedyncza wartość, per kod.
/// </summary>
/// <param name="PermissionCode">Kod z <see cref="Erp.BuildingBlocks.Contracts.Permissions"/>.</param>
/// <param name="SourceRoleUuid"><c>null</c> = nadane bezpośrednio użytkownikowi.</param>
/// <param name="SourceRoleCode">Kod roli źródłowej — wygodny do wyświetlenia bez drugiego zapytania.</param>
/// <param name="ViaContainerRoleUuid">Gdy uprawnienie przyszło z roli będącej składową innej,
/// przypisanej wprost użytkownikowi roli-kontenera — <c>null</c>, gdy rola źródłowa jest
/// przypisana użytkownikowi bezpośrednio (głębokość dziedziczenia 0).</param>
public sealed record EffectivePermissionSourceDto(
    string PermissionCode, Guid? SourceRoleUuid, string? SourceRoleCode, Guid? ViaContainerRoleUuid);

/// <summary>Filtry wyszukiwania użytkowników.</summary>
public sealed class SearchUserAccountRequest : PagedRequest
{
    public string? Email { get; set; }
}

/// <summary>Pobranie użytkowników po identyfikatorach.</summary>
public sealed class GetUserAccountRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Odczyty użytkowników. Implementacja w <c>Identity.Infrastructure</c>.</summary>
public interface IUserAccountQueries
{
    Task<SearchResponse> SearchAsync(SearchUserAccountRequest request, CancellationToken cancellationToken);

    Task<List<UserAccountDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>Efektywny zbiór kodów uprawnień — role przypisane wprost + ich składowe
    /// (rekursywnie) + uprawnienia bezpośrednie. Zasila <c>GET /me/permissions</c> i
    /// <c>GET /internal/users/{id}/permissions</c> (Faza 3).</summary>
    Task<HashSet<string>> GetEffectivePermissionCodesAsync(Guid userUuid, CancellationToken cancellationToken);

    /// <summary>Jak wyżej, ale z rozwinięciem źródła każdego kodu — zasila ekran "skąd to
    /// uprawnienie" (Faza 4).</summary>
    Task<List<EffectivePermissionSourceDto>> GetEffectivePermissionSourcesAsync(
        Guid userUuid, CancellationToken cancellationToken);
}
