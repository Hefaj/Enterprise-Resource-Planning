namespace Catalog.Application.Contracts;

using System;
using System.Collections.Generic;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

// CA1707 (podkreślenia w nazwach) jest tu wyłączone świadomie i punktowo: `Attr_Weight`
// i `Attr_Color` to istniejące nazwy pól kontraktu API, konsumowane przez wygenerowanego
// klienta na frontendzie. Zmiana nazwy dla zgodności z konwencją .NET zepsułaby frontend
// bez żadnej korzyści funkcjonalnej. Docelowo oba pola zastąpi słownik atrybutów.
#pragma warning disable CA1707

/// <summary>Produkt katalogu.</summary>
public sealed record ProductDto(
    Guid Uuid,
    string Name,
    List<Guid> CategoryUuids,
    List<Guid> MultimediaUuids,
    List<ProductWarrantyDto> Warranties,
    Guid? ModelUuid,
    string Sku,
    decimal Price,
    DateTime? AvailableFrom,
    string Status,
    bool Available,
    string Ean,
    string? Image,
    string Attr_Weight,
    string Attr_Color);

#pragma warning restore CA1707
