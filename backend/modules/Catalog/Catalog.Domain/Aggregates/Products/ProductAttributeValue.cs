using Catalog.Domain.Attributes;
using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Products;

/// <summary>
/// Wartość atrybutu nadana produktowi.
///
/// <para><b>Dlaczego kolumny typowane, a nie jeden <c>value_text</c>.</b> Atrybut wartościowy
/// niesie liczbę, datę albo flagę i sortowanie musi to widzieć: przy jednej kolumnie tekstowej
/// „10” jest mniejsze niż „9”, a filtr „waga powyżej 5 kg” wymaga rzutowania każdego wiersza
/// w locie — czyli pełnego skanu i wyjątku na pierwszej wartości, której nie da się sparsować.
/// Osobne kolumny kosztują trochę pustych pól i wracają porównaniami po indeksie.</para>
///
/// <para>Wypełniona jest zawsze DOKŁADNIE JEDNA gałąź wartości; pilnują tego statyczne fabryki
/// niżej, a niezależnie od nich ograniczenie CHECK w bazie (patrz
/// <c>ProductAttributeValueConfiguration</c>) — model domenowy nie jest jedyną drogą do tabeli.</para>
///
/// <para>Byt wewnętrzny agregatu <see cref="Product"/> — identyfikator nadaje baza,
/// z tego samego powodu co przy <see cref="ProductCategoryLink"/>.</para>
/// </summary>
public sealed class ProductAttributeValue
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProductAttributeValue()
    {
    }

    internal ProductAttributeValue(Guid productUuid, ProductAttributeAssignment assignment)
    {
        ArgumentNullException.ThrowIfNull(assignment);

        ProductUuid = productUuid;
        AttributeUuid = assignment.AttributeUuid;
        Kind = assignment.Kind;
        IsMultiValue = assignment.IsMultiValue;
        OptionUuid = assignment.OptionUuid;
        MultimediaUuid = assignment.MultimediaUuid;
        ValueText = assignment.ValueText;
        ValueNumber = assignment.ValueNumber;
        ValueBoolean = assignment.ValueBoolean;
        ValueDate = assignment.ValueDate;
        SortOrder = assignment.SortOrder;
    }

    /// <summary>Klucz techniczny nadawany przez bazę — patrz komentarz nad <see cref="ProductCategoryLink"/>.</summary>
    public Guid Uuid { get; private set; }

    public Guid ProductUuid { get; private set; }

    /// <summary>Definicja atrybutu (<c>AttributeDefinition</c>).</summary>
    public Guid AttributeUuid { get; private set; }

    /// <summary>Kopia rodzaju z definicji — po niej odczyt wie, którą gałąź wartości czytać,
    /// bez dołączania słownika do każdego zapytania o produkt.</summary>
    public AttributeKind Kind { get; private set; }

    /// <summary>
    /// Kopia <c>AttributeDefinition.IsMultiValue</c>. Denormalizacja z konkretnego powodu:
    /// reguła „atrybut jednowartościowy występuje przy produkcie najwyżej raz” musi być
    /// indeksem w bazie, a indeks nie potrafi zajrzeć do innej tabeli. Bez tej kolumny
    /// zostałaby wyłącznie walidacja aplikacyjna, którą dwa równoległe żądania przechodzą oba.
    /// </summary>
    public bool IsMultiValue { get; private set; }

    /// <summary>Wybrana pozycja słownika — wyłącznie dla <see cref="AttributeKind.Dictionary"/>.</summary>
    public Guid? OptionUuid { get; private set; }

    /// <summary>Wskazany zasób — wyłącznie dla <see cref="AttributeKind.Multimedia"/>.</summary>
    public Guid? MultimediaUuid { get; private set; }

    public string? ValueText { get; private set; }

    public decimal? ValueNumber { get; private set; }

    public bool? ValueBoolean { get; private set; }

    public DateTimeOffset? ValueDate { get; private set; }

    /// <summary>Kolejność w obrębie atrybutu — ma znaczenie tylko dla wielowartościowych.</summary>
    public int SortOrder { get; private set; }
}

/// <summary>
/// Wartość atrybutu do nadania produktowi — wejście <see cref="Product.SetAttributeValues"/>.
///
/// <para>Konstruktor jest prywatny, a jedyną drogą do utworzenia są fabryki niżej, z których
/// każda wymaga <see cref="AttributeDefinition"/>. To tam mieszka reguła spójności: atrybut
/// słownikowy dostaje wyłącznie własną opcję, wartościowy wyłącznie wartość w zadeklarowanym
/// typie, multimedialny wyłącznie zasób. Bez tego handler komendy mógłby złożyć „wartość
/// liczbową atrybutu multimedialnego” i zapis przeszedłby aż do ograniczenia CHECK.</para>
/// </summary>
public sealed record ProductAttributeAssignment
{
    private ProductAttributeAssignment(AttributeDefinition definition, int sortOrder)
    {
        AttributeUuid = definition.Uuid;
        Kind = definition.Kind;
        IsMultiValue = definition.IsMultiValue;
        SortOrder = sortOrder;
    }

    public Guid AttributeUuid { get; }

    public AttributeKind Kind { get; }

    /// <summary>Przepisane z definicji — patrz <see cref="ProductAttributeValue.IsMultiValue"/>.</summary>
    public bool IsMultiValue { get; }

    public Guid? OptionUuid { get; private init; }

    public Guid? MultimediaUuid { get; private init; }

    public string? ValueText { get; private init; }

    public decimal? ValueNumber { get; private init; }

    public bool? ValueBoolean { get; private init; }

    public DateTimeOffset? ValueDate { get; private init; }

    public int SortOrder { get; }

    /// <summary>Wskazanie pozycji ze słownika atrybutu.</summary>
    public static ProductAttributeAssignment Option(
        AttributeDefinition definition, Guid optionUuid, int sortOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(definition);
        Require(definition, AttributeKind.Dictionary);

        if (!definition.OwnsOption(optionUuid))
        {
            throw new DomainException(
                "attribute_option_unknown",
                $"Wartość {optionUuid} nie należy do atrybutu {definition.Code}.");
        }

        return new ProductAttributeAssignment(definition, sortOrder)
        {
            OptionUuid = optionUuid,
        };
    }

    /// <summary>Wskazanie zasobu multimedialnego.</summary>
    public static ProductAttributeAssignment Multimedia(
        AttributeDefinition definition, Guid multimediaUuid, int sortOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(definition);
        Require(definition, AttributeKind.Multimedia);

        if (multimediaUuid == Guid.Empty)
        {
            throw new DomainException(
                "attribute_multimedia_empty",
                $"Atrybut {definition.Code} wymaga wskazania zasobu multimedialnego.");
        }

        return new ProductAttributeAssignment(definition, sortOrder)
        {
            MultimediaUuid = multimediaUuid,
        };
    }

    public static ProductAttributeAssignment Text(AttributeDefinition definition, string value, int sortOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(definition);
        RequireValue(definition, AttributeDataType.Text);

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException(
                "attribute_value_empty",
                $"Wartość atrybutu {definition.Code} nie może być pusta.");
        }

        return new ProductAttributeAssignment(definition, sortOrder)
        {
            ValueText = value.Trim(),
        };
    }

    public static ProductAttributeAssignment Number(AttributeDefinition definition, decimal value, int sortOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(definition);
        RequireValue(definition, AttributeDataType.Number);

        return new ProductAttributeAssignment(definition, sortOrder)
        {
            ValueNumber = value,
        };
    }

    public static ProductAttributeAssignment Boolean(AttributeDefinition definition, bool value, int sortOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(definition);
        RequireValue(definition, AttributeDataType.Boolean);

        return new ProductAttributeAssignment(definition, sortOrder)
        {
            ValueBoolean = value,
        };
    }

    public static ProductAttributeAssignment Date(
        AttributeDefinition definition, DateTimeOffset value, int sortOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(definition);
        RequireValue(definition, AttributeDataType.Date);

        return new ProductAttributeAssignment(definition, sortOrder)
        {
            ValueDate = value,
        };
    }

    private static void Require(AttributeDefinition definition, AttributeKind kind)
    {
        if (definition.Kind != kind)
        {
            throw new DomainException(
                "attribute_kind_mismatch",
                $"Atrybut {definition.Code} jest rodzaju {definition.Kind}, a wartość podano jak dla {kind}.");
        }
    }

    private static void RequireValue(AttributeDefinition definition, AttributeDataType dataType)
    {
        Require(definition, AttributeKind.Value);

        if (definition.DataType != dataType)
        {
            throw new DomainException(
                "attribute_data_type_mismatch",
                $"Atrybut {definition.Code} jest typu {definition.DataType}, a wartość podano jako {dataType}.");
        }
    }
}
