using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Attributes;

/// <summary>
/// Dopuszczalna wartość atrybutu słownikowego („Czarny”, „Stal nierdzewna”).
///
/// <para>Byt wewnętrzny agregatu <see cref="AttributeDefinition"/>: nie ma sensu bez niego
/// i nie jest ładowany samodzielnie. Ma jednak WŁASNY, trwały identyfikator nadawany
/// w konstruktorze — inaczej niż powiązania produktu — bo to na niego wskazuje
/// <c>ProductAttributeValue.OptionUuid</c>. Wartość wskazywana przez tysiące produktów
/// nie może dostać nowego klucza przy każdym zapisie słownika.</para>
///
/// <para>Konsekwencja dla EF: identyfikator jest ustawiony, więc przy dopisywaniu opcji do
/// wczytanego agregatu obowiązuje ta sama pułapka co przy powiązaniach produktu — nowa opcja
/// z ustawionym kluczem zostałaby wzięta za wiersz istniejący. Dlatego
/// <see cref="AttributeDefinition.ReplaceOptions"/> operuje na RÓŻNICY zbiorów i nigdy
/// nie kasuje kolekcji, żeby wstawić ją od nowa.</para>
/// </summary>
public sealed class AttributeOption : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private AttributeOption()
    {
    }

    internal AttributeOption(Guid uuid, Guid attributeUuid, string code, string name, int sortOrder)
        : base(uuid)
    {
        AttributeUuid = attributeUuid;
        Code = code;
        Name = name;
        SortOrder = sortOrder;
    }

    public Guid AttributeUuid { get; private set; }

    /// <summary>Symbol techniczny opcji, unikalny w obrębie atrybutu — po nim mapują się
    /// importy i integracje, niezależnie od tego, jak brzmi etykieta.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public int SortOrder { get; private set; }

    internal void Update(string name, int sortOrder)
    {
        Name = name;
        SortOrder = sortOrder;
    }
}
