namespace Identity.Infrastructure.Persistence;

/// <summary>
/// Wiersz tabeli <c>permission_catalog</c> — projekcja
/// <see cref="Erp.BuildingBlocks.Contracts.PermissionDefinition"/> w bazie, uzgadniana przy
/// starcie (patrz <c>PermissionCatalogReconciler</c>). Celowo NIE agregat: brak reguł
/// biznesowych, brak zdarzeń, nikt go nie modyfikuje przez UI poza samym uzgodnieniem —
/// zwykła encja EF, klucz to <see cref="Code"/>, nie <c>Uuid</c>.
/// </summary>
public sealed class PermissionCatalogEntry
{
    public string Code { get; set; } = string.Empty;

    public string Module { get; set; } = string.Empty;

    public string Resource { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string DescriptionKey { get; set; } = string.Empty;

    /// <summary>Kod zniknął z <see cref="Erp.BuildingBlocks.Contracts.Permissions.All"/> —
    /// istniejące nadania mogą wciąż na niego wskazywać, więc wiersz zostaje, tylko oznaczony.
    /// UI pokazuje go z ostrzeżeniem i pozwala jedynie odebrać, nigdy nadać ponownie.</summary>
    public bool IsObsolete { get; set; }
}
