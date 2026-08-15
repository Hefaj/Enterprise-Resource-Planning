namespace Catalog.Application.Contracts;

using System;
using System.Collections.Generic;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>
/// Produkt katalogu.
///
/// <para>Identyfikatory handlowe (SKU, EAN) i cechy opisowe nie są tu polami: pierwsze siedzą
/// w <see cref="Codes"/>, drugie w <see cref="Attributes"/>. Poprzedni kształt miał na to
/// kolumny <c>Sku</c>, <c>Ean</c>, <c>Attr_Weight</c> i <c>Attr_Color</c>, czyli każdy nowy kod
/// albo cecha oznaczały migrację, pole w kontrakcie i regenerację klienta. Ceną jest to,
/// że konsument musi rozwiązać typ kodu (<c>getCodeType</c>) i definicję atrybutu
/// (<c>getAttribute</c>) — oba są słownikami, więc w praktyce raz na sesję.</para>
/// </summary>
public sealed record ProductDto(
    Guid Uuid,
    string Name,
    List<Guid> CategoryUuids,
    List<Guid> MultimediaUuids,
    List<ProductWarrantyDto> Warranties,
    List<ProductCodeDto> Codes,
    List<ProductAttributeValueDto> Attributes,
    Guid? ModelUuid,
    decimal Price,
    DateTime? AvailableFrom,
    string Status,
    bool Available,
    string? Image);

/// <summary>Kod nadany produktowi — typ ze słownika plus wartość.</summary>
public sealed record ProductCodeDto(
    Guid Uuid,
    Guid CodeTypeUuid,
    string Value);

/// <summary>
/// Wartość atrybutu produktu.
///
/// <para>Wypełnione jest dokładnie jedno pole wartości — które, rozstrzyga <c>Kind</c>
/// (i dla wartościowych <c>DataType</c> z definicji atrybutu). Rekord jest płaski, a nie
/// wariantowy, bo NSwag generuje z hierarchii typów kod, którego konsument i tak musi
/// rozgałęziać po dyskryminatorze — a płaski kształt robi to samo bez rzutowań.</para>
/// </summary>
public sealed record ProductAttributeValueDto(
    Guid Uuid,
    Guid AttributeUuid,
    string Kind,
    Guid? OptionUuid,
    Guid? MultimediaUuid,
    string? ValueText,
    decimal? ValueNumber,
    bool? ValueBoolean,
    DateTime? ValueDate,
    int SortOrder);
