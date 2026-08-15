namespace Catalog.Domain.Attributes;

/// <summary>
/// Rodzaj atrybutu — rozstrzyga, GDZIE mieszka wartość przypisana produktowi.
///
/// <para>Enum, a nie słownik w bazie (w odróżnieniu od <see cref="Codes.CodeType"/>): każdy
/// rodzaj ma własny kształt kolumn w <c>product_attribute_value</c> i własną gałąź walidacji,
/// więc dodanie nowego i tak wymaga kodu. Wartość w bazie jest zapisana jako <c>int</c>
/// — zmiana numeracji istniejących pozycji jest zmianą łamiącą dane.</para>
/// </summary>
public enum AttributeKind
{
    /// <summary>Wartość wskazuje pozycję ze zdefiniowanej listy (<c>AttributeOption</c>).
    /// Kolor, materiał, rozmiar — wszystko, co ma zamknięty zbiór dopuszczalnych odpowiedzi.</summary>
    Dictionary = 1,

    /// <summary>Wartość wpisywana wprost, w typie wskazanym przez <see cref="AttributeDataType"/>.</summary>
    Value = 2,

    /// <summary>Wartość wskazuje zasób multimedialny (<c>MultimediaAsset</c>) — karta katalogowa,
    /// rysunek techniczny, film instruktażowy.</summary>
    Multimedia = 3,
}

/// <summary>
/// Typ danych atrybutu wartościowego. Dla pozostałych rodzajów jest zawsze
/// <see cref="None"/> — pilnuje tego <c>AttributeDefinition</c>.
///
/// <para>Rozróżnienie nie jest kosmetyczne: od niego zależy, do której kolumny trafia wartość
/// (<c>value_text</c> / <c>value_number</c> / <c>value_boolean</c> / <c>value_date</c>),
/// a więc czy filtr „waga powyżej 5 kg” jest porównaniem liczb, czy stringów — w tym drugim
/// przypadku „10” jest mniejsze niż „9”.</para>
/// </summary>
public enum AttributeDataType
{
    /// <summary>Nie dotyczy — atrybut słownikowy albo multimedialny.</summary>
    None = 0,

    Text = 1,

    Number = 2,

    Boolean = 3,

    Date = 4,
}
