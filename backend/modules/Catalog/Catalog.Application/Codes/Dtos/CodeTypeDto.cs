namespace Catalog.Application.Codes;

using System;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Typ kodu produktu ze słownika katalogu.</summary>
public sealed record CodeTypeDto(
    Guid Uuid,
    string Symbol,
    string Name,
    string? Pattern,
    bool IsUnique,
    int SortOrder);
