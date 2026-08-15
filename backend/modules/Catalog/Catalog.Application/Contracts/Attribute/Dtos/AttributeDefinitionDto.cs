namespace Catalog.Application.Contracts;

using System;
using System.Collections.Generic;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>
/// Definicja atrybutu produktu.
///
/// <para><c>Kind</c> i <c>DataType</c> jadą jako stringi (<c>Dictionary</c> / <c>Value</c> /
/// <c>Multimedia</c>, <c>Text</c> / <c>Number</c> / <c>Boolean</c> / <c>Date</c> / <c>None</c>),
/// tak samo jak <c>ProductDto.Status</c>: numeracja enuma jest szczegółem zapisu w bazie,
/// a kontrakt HTTP ma być czytelny bez zaglądania do kodu backendu.</para>
/// </summary>
public sealed record AttributeDefinitionDto(
    Guid Uuid,
    string Code,
    string Name,
    string Kind,
    string DataType,
    bool IsMultiValue,
    int SortOrder,
    List<AttributeOptionDto> Options);

/// <summary>Dopuszczalna wartość atrybutu słownikowego.</summary>
public sealed record AttributeOptionDto(
    Guid Uuid,
    string Code,
    string Name,
    int SortOrder);
