namespace Catalog.Application.Contracts;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Gwarancja przypisana do produktu wraz z faktycznym okresem.</summary>
public sealed record ProductWarrantyDto(
    Guid WarrantyUuid,
    int DurationMonths);
