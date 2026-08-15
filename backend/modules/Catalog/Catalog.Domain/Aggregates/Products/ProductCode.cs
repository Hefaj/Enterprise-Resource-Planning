using System.Globalization;
using Catalog.Domain.Codes;

namespace Catalog.Domain.Products;

/// <summary>
/// Kod nadany produktowi — para (typ ze słownika, wartość).
///
/// <para>Zastępuje kolumny <c>sku</c> i <c>ean</c>. Powód jest ten sam, dla którego atrybuty
/// przestały być kolumnami: liczba identyfikatorów produktu rośnie z każdym kanałem sprzedaży,
/// a każda kolumna to migracja, pole w DTO i regeneracja klienta. Tutaj nowy typ kodu to wiersz
/// w <c>code_type</c>, a produkt nie zmienia kształtu.</para>
///
/// <para>Byt wewnętrzny agregatu <see cref="Product"/> — identyfikator nadaje baza,
/// z dokładnie tego powodu co przy <see cref="ProductCategoryLink"/>.</para>
/// </summary>
public sealed class ProductCode
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProductCode()
    {
    }

    internal ProductCode(Guid productUuid, Guid codeTypeUuid, string value, bool unique)
    {
        ProductUuid = productUuid;
        CodeTypeUuid = codeTypeUuid;
        Value = value;
        UniqueKey = unique ? ComputeUniqueKey(codeTypeUuid, value) : null;
    }

    /// <summary>Klucz techniczny nadawany przez bazę — patrz komentarz nad <see cref="ProductCategoryLink"/>.</summary>
    public Guid Uuid { get; private set; }

    public Guid ProductUuid { get; private set; }

    /// <summary>Typ kodu ze słownika (<c>CodeType</c>).</summary>
    public Guid CodeTypeUuid { get; private set; }

    /// <summary>Wartość kodu w postaci nadanej przez użytkownika (po przycięciu białych znaków).</summary>
    public string Value { get; private set; } = string.Empty;

    /// <summary>
    /// Sygnatura unikalności — <c>null</c>, gdy typ kodu nie wymaga unikalności.
    ///
    /// <para>Ten sam wzorzec co <c>Product.DuplicateKey</c> i z tego samego powodu: reguła
    /// „SKU jest unikalne, ale kod producenta już nie” zależy od WIERSZA SŁOWNIKA, a nie od
    /// kolumny w tej tabeli, więc zwykły indeks unikalny po (typ, wartość) by jej nie wyraził —
    /// objąłby też typy, które z natury się powtarzają. Kolumna wypełniona tylko dla typów
    /// unikalnych plus indeks częściowy <c>WHERE unique_key IS NOT NULL</c> daje dokładnie
    /// tę regułę, a Postgres egzekwuje ją także przy równoległych żądaniach.</para>
    /// </summary>
    public string? UniqueKey { get; private set; }

    /// <summary>
    /// Liczy sygnaturę unikalności. Wielkość liter celowo nie ma znaczenia: <c>sku-001</c>
    /// i <c>SKU-001</c> to dla człowieka ten sam identyfikator handlowy i muszą kolidować,
    /// a nie wylądować w indeksie jako dwie różne wartości.
    /// </summary>
    public static string ComputeUniqueKey(Guid codeTypeUuid, string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        return string.Create(
            CultureInfo.InvariantCulture,
            $"{codeTypeUuid:D}|{value.Trim().ToUpperInvariant()}");
    }
}

/// <summary>
/// Kod do nadania produktowi — wejście <see cref="Product.SetCodes"/>.
///
/// <para>Osobny typ, a nie gotowy <see cref="ProductCode"/>, bo powstaje PRZED wywołaniem
/// metody domenowej i nie zna jeszcze produktu. Przy okazji jedyną drogą do jego utworzenia
/// jest <see cref="For"/>, które wymaga wiersza słownika — dzięki temu nie da się nadać kodu
/// typu, którego nie ma, ani ominąć maski wartości.</para>
/// </summary>
public sealed record ProductCodeAssignment
{
    private ProductCodeAssignment(Guid codeTypeUuid, string value, bool unique)
    {
        CodeTypeUuid = codeTypeUuid;
        Value = value;
        Unique = unique;
    }

    public Guid CodeTypeUuid { get; }

    public string Value { get; }

    /// <summary>Przepisane z <see cref="CodeType.IsUnique"/> w chwili nadania kodu.</summary>
    public bool Unique { get; }

    /// <summary>Waliduje wartość wobec typu i przygotowuje ją do zapisu.</summary>
    public static ProductCodeAssignment For(CodeType codeType, string value)
    {
        ArgumentNullException.ThrowIfNull(codeType);

        return new ProductCodeAssignment(codeType.Uuid, codeType.Validate(value), codeType.IsUnique);
    }
}
