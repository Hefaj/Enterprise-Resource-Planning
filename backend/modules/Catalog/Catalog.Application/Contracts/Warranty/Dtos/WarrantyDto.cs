namespace Catalog.Application.Contracts;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Definicja gwarancji z katalogu.</summary>
public sealed record WarrantyDto(
    Guid Uuid,
    string Name,
    int DurationMonths,
    string Description);
