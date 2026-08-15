using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Attributes;

/// <summary>
/// Definicja atrybutu produktu — pozycja słownika opisująca, CO można o produkcie powiedzieć
/// i w jakiej formie.
///
/// <para><b>Dlaczego to zastępuje kolumny <c>attr_weight</c> i <c>attr_color</c>.</b> Atrybuty
/// są danymi katalogu, nie schematem: każda nowa cecha oznaczała dotąd migrację, kolumnę
/// w <c>product</c>, pole w DTO i regenerację klienta. Tutaj nowa cecha to jeden wiersz
/// słownika, a produkty odwołują się do niej przez <c>ProductAttributeValue</c>.</para>
///
/// <para><b>Granica agregatu.</b> W środku są wyłącznie dopuszczalne wartości
/// (<see cref="AttributeOption"/>) — nie mają sensu bez definicji. Produkty korzystające
/// z atrybutu są na zewnątrz i widzą go wyłącznie przez identyfikator.</para>
/// </summary>
public class AttributeDefinition : AggregateRoot
{
    private readonly List<AttributeOption> _options = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    protected AttributeDefinition()
    {
    }

    private AttributeDefinition(
        Guid uuid,
        string code,
        string name,
        AttributeKind kind,
        AttributeDataType dataType,
        bool isMultiValue,
        int sortOrder) : base(uuid)
    {
        Code = code;
        Name = name;
        Kind = kind;
        DataType = dataType;
        IsMultiValue = isMultiValue;
        SortOrder = sortOrder;
    }

    /// <summary>Symbol techniczny, unikalny w słowniku (<c>WEIGHT</c>, <c>COLOR</c>).</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    /// <summary>Gdzie mieszka wartość — patrz <see cref="AttributeKind"/>.
    /// Niezmienny po utworzeniu: zmiana rodzaju unieważniłaby wszystkie zapisane wartości.</summary>
    public AttributeKind Kind { get; private set; }

    /// <summary>Typ danych dla <see cref="AttributeKind.Value"/>; dla pozostałych rodzajów
    /// zawsze <see cref="AttributeDataType.None"/>.</summary>
    public AttributeDataType DataType { get; private set; }

    /// <summary>Czy produkt może mieć wiele wartości tego atrybutu (np. kilka certyfikatów).
    /// Dla atrybutów jednowartościowych regułę egzekwuje unikalny indeks częściowy
    /// na <c>product_attribute_value</c>.</summary>
    public bool IsMultiValue { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>Dopuszczalne wartości — niepusta wyłącznie dla <see cref="AttributeKind.Dictionary"/>.</summary>
    public IReadOnlyCollection<AttributeOption> Options => _options.AsReadOnly();

    public static AttributeDefinition Create(
        string code, string name, AttributeKind kind, AttributeDataType dataType, bool isMultiValue, int sortOrder)
        => new(NewUuid(), ValidateCode(code), ValidateName(name), kind,
               ValidateDataType(kind, dataType), isMultiValue, sortOrder);

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static AttributeDefinition CreateWithUuid(
        Guid uuid, string code, string name, AttributeKind kind, AttributeDataType dataType,
        bool isMultiValue, int sortOrder)
        => new(uuid, ValidateCode(code), ValidateName(name), kind,
               ValidateDataType(kind, dataType), isMultiValue, sortOrder);

    public void Rename(string name)
    {
        var validated = ValidateName(name);
        if (string.Equals(Name, validated, StringComparison.Ordinal))
        {
            return;
        }

        Name = validated;
    }

    /// <summary>
    /// Podmienia komplet dopuszczalnych wartości. Opcje rozpoznawane po
    /// <see cref="AttributeOption.Code"/>: istniejąca dostaje nową etykietę i kolejność,
    /// zachowując identyfikator, a znika tylko ta, której w zadanym zbiorze nie ma.
    ///
    /// <para>To nie jest optymalizacja, tylko warunek poprawności: identyfikator opcji jest
    /// zapisany przy każdym produkcie, który ją wybrał. Wyczyszczenie kolekcji i wstawienie
    /// jej od nowa nadałoby „Czarnemu” nowy klucz, a wszystkie produkty zostałyby ze
    /// wskazaniem na opcję, której już nie ma — bez żadnego błędu przy zapisie, bo między
    /// agregatami nie ma klucza obcego (patrz <c>ProductAttributeValueConfiguration</c>).</para>
    /// </summary>
    public void SetOptions(IEnumerable<(string Code, string Name, int SortOrder)> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (Kind != AttributeKind.Dictionary)
        {
            throw new DomainException(
                "attribute_options_not_applicable",
                $"Atrybut {Code} nie jest słownikowy — nie ma dla niego listy dopuszczalnych wartości.");
        }

        ReplaceOptions([.. options]);
    }

    /// <summary>Odnajduje opcję po symbolu; <c>null</c>, gdy atrybut jej nie zna.</summary>
    public AttributeOption? FindOption(string code)
        => _options.Find(o => string.Equals(o.Code, code, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Sprawdza, czy wskazana opcja należy do tego atrybutu. Wołane przy nadawaniu wartości
    /// produktowi — bez tego produkt mógłby dostać kolor z listy rozmiarów, a baza przyjęłaby
    /// to bez mrugnięcia (klucz obcy wskazuje na <c>attribute_option</c>, nie na parę
    /// atrybut + opcja).
    /// </summary>
    public bool OwnsOption(Guid optionUuid) => _options.Exists(o => o.Uuid == optionUuid);

    private void ReplaceOptions(List<(string Code, string Name, int SortOrder)> options)
    {
        var target = options
            .GroupBy(o => o.Code.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last(), StringComparer.OrdinalIgnoreCase);

        _options.RemoveAll(option => !target.ContainsKey(option.Code));

        foreach (var (code, option) in target)
        {
            var existing = FindOption(code);
            if (existing is null)
            {
                _options.Add(new AttributeOption(
                    NewUuid(), Uuid, code, ValidateName(option.Name), option.SortOrder));
                continue;
            }

            existing.Update(ValidateName(option.Name), option.SortOrder);
        }
    }

    private static string ValidateCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("attribute_code_empty", "Symbol atrybutu nie może być pusty.");
        }

        return code.Trim().ToUpperInvariant();
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("attribute_name_empty", "Nazwa atrybutu nie może być pusta.");
        }

        return name.Trim();
    }

    /// <summary>
    /// Pilnuje, żeby typ danych szedł w parze z rodzajem: atrybut wartościowy MUSI go mieć,
    /// a słownikowy i multimedialny nie mogą — ich wartość nie mieszka w kolumnach typowanych.
    /// Bez tego dałoby się zapisać „atrybut słownikowy typu liczbowego”, czyli konfigurację,
    /// której żadna gałąź walidacji wartości nie obsłuży.
    /// </summary>
    private static AttributeDataType ValidateDataType(AttributeKind kind, AttributeDataType dataType)
    {
        if (kind == AttributeKind.Value)
        {
            if (dataType == AttributeDataType.None)
            {
                throw new DomainException(
                    "attribute_data_type_required",
                    "Atrybut wartościowy wymaga typu danych.");
            }

            return dataType;
        }

        if (dataType != AttributeDataType.None)
        {
            throw new DomainException(
                "attribute_data_type_not_applicable",
                "Typ danych ma sens wyłącznie dla atrybutu wartościowego.");
        }

        return AttributeDataType.None;
    }
}
