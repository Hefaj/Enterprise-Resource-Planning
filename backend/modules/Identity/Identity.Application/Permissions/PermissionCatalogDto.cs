namespace Identity.Application.Permissions;

/// <summary>Wiersz katalogu uprawnień w widoku odczytu — projekcja tabeli <c>permission_catalog</c>,
/// uzgadnianej przy starcie z <see cref="Erp.BuildingBlocks.Contracts.Permissions.All"/> (patrz
/// <c>PermissionCatalogReconciler</c>). Read-only z UI — patrz <c>docs/backend/identity-authz.md</c> §3.</summary>
public sealed record PermissionCatalogEntryDto(
    string Code, string Module, string Resource, string Action, string DescriptionKey, bool IsObsolete);

/// <summary>Odczyt katalogu uprawnień. Implementacja w <c>Identity.Infrastructure</c>.</summary>
public interface IPermissionCatalogQueries
{
    Task<List<PermissionCatalogEntryDto>> GetAllAsync(CancellationToken cancellationToken);
}
