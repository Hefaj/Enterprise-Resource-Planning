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

    /// <summary>
    /// Spośród podanych kodów zwraca te, które istnieją w katalogu i NIE są oznaczone jako
    /// <c>IsObsolete</c> — nadawanie uprawnienia po kodzie, którego katalog już nie zna (literówka
    /// albo wycofany kod), ma być odrzucone przed utworzeniem zadania, nie zapisane do bazy
    /// jako martwy `permission_code`. Używane przez <c>PermissionCodeMustExistRule</c>.
    /// </summary>
    Task<List<string>> GetExistingCodesAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken);
}
