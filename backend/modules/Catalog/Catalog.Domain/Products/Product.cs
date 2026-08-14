using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Products;

/// <summary>
/// Produkt — główny agregat katalogu.
///
/// <para><b>Granica agregatu.</b> Wewnątrz są tylko byty, które nie mają sensu bez produktu:
/// przypisania kategorii, powiązania z multimediami i okresy gwarancji. Same kategorie,
/// multimedia, modele i definicje gwarancji to osobne agregaty — produkt trzyma do nich
/// wyłącznie identyfikatory, nigdy referencje obiektowe. Dzięki temu wczytanie produktu
/// nie wciąga za sobą pół katalogu, a zmiana nazwy kategorii nie wymaga dotykania produktów.</para>
///
/// <para><b>Reguła nadrzędna:</b> stan zmieniają wyłącznie metody poniżej, a każda z nich
/// najpierw sprawdza regułę, a dopiero potem modyfikuje pola. Ta kolejność nie jest kwestią
/// stylu — opiera się na niej <c>BulkCommandRunner</c>: skoro <see cref="DomainException"/>
/// oznacza, że nic się nie zmieniło, błąd jednego elementu nie zanieczyszcza transakcji
/// i pozostałe elementy chunka mogą się zapisać.</para>
/// </summary>
public class Product : AggregateRoot
{
    private readonly List<ProductCategoryLink> _categories = [];
    private readonly List<ProductMultimediaLink> _multimedia = [];
    private readonly List<ProductWarranty> _warranties = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    protected Product()
    {
    }

    private Product(Guid uuid, string name, string sku, string ean, decimal price) : base(uuid)
    {
        Name = name;
        Sku = sku;
        Ean = ean;
        Price = price;
        Status = ProductStatus.Draft;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Kod magazynowy — identyfikator handlowy, unikalny w katalogu.</summary>
    public string Sku { get; private set; } = string.Empty;

    /// <summary>Kod kreskowy EAN.</summary>
    public string Ean { get; private set; } = string.Empty;

    public decimal Price { get; private set; }

    public DateTimeOffset? AvailableFrom { get; private set; }

    public ProductStatus Status { get; private set; }

    /// <summary>
    /// Dostępność produktu. Celowo właściwość wyliczana, a nie osobne pole:
    /// w danych mockowych „available” i „status” były dwoma niezależnie zapisywanymi polami
    /// o tym samym znaczeniu, co jest zaproszeniem do rozjechania się ich w czasie.
    /// Kontrakt HTTP nadal zwraca oba.
    /// </summary>
    public bool Available => Status == ProductStatus.Active;

    /// <summary>Model, którego wariantem jest produkt; <c>null</c>, jeśli samodzielny.</summary>
    public Guid? ModelUuid { get; private set; }

    /// <summary>Zdjęcie główne (URL); galeria żyje w <see cref="MultimediaUuids"/>.</summary>
    public string? Image { get; private set; }

    /// <summary>Atrybut opisowy — waga. Docelowo część słownika atrybutów; na razie
    /// odwzorowuje pole obecne w kontrakcie API (<c>Attr_Weight</c>).</summary>
    public string AttrWeight { get; private set; } = string.Empty;

    /// <summary>Atrybut opisowy — kolor (<c>Attr_Color</c> w kontrakcie API).</summary>
    public string AttrColor { get; private set; } = string.Empty;

    /// <summary>Identyfikatory kategorii, do których należy produkt.</summary>
    public IReadOnlyCollection<Guid> CategoryUuids
        => [.. _categories.Select(c => c.CategoryUuid)];

    /// <summary>Identyfikatory zasobów multimedialnych produktu.</summary>
    public IReadOnlyCollection<Guid> MultimediaUuids
        => [.. _multimedia.Select(m => m.MultimediaUuid)];

    /// <summary>Gwarancje przypisane do produktu wraz z faktycznym okresem.</summary>
    public IReadOnlyCollection<ProductWarranty> Warranties => _warranties.AsReadOnly();

    public static Product Create(string name, string sku, string ean, decimal price)
        => new(NewUuid(), ValidateName(name), ValidateSku(sku), ean ?? string.Empty, ValidatePrice(price));

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static Product CreateWithUuid(Guid uuid, string name, string sku, string ean, decimal price)
        => new(uuid, ValidateName(name), ValidateSku(sku), ean ?? string.Empty, ValidatePrice(price));

    /// <summary>Zmienia nazwę produktu. Bez zmiany, gdy nazwa jest ta sama — wtedy nie powstaje
    /// zdarzenie ani wpis w ChangeTrackerze, więc nie generuje się też pusty ruch po SignalR.</summary>
    public void SetName(string name, DateTimeOffset occurredAt)
    {
        var validated = ValidateName(name);
        if (string.Equals(Name, validated, StringComparison.Ordinal))
        {
            return;
        }

        var oldName = Name;
        Name = validated;
        Raise(new ProductNameChanged(Uuid, oldName, validated, occurredAt));
    }

    /// <summary>Ustawia cenę produktu.</summary>
    public void SetPrice(decimal price, DateTimeOffset occurredAt)
    {
        var validated = ValidatePrice(price);
        if (Price == validated)
        {
            return;
        }

        var oldPrice = Price;
        Price = validated;
        Raise(new ProductPriceChanged(Uuid, oldPrice, validated, occurredAt));
    }

    /// <summary>Zmienia status produktu (a wraz z nim dostępność).</summary>
    public void SetStatus(ProductStatus status, DateTimeOffset occurredAt)
    {
        if (Status == status)
        {
            return;
        }

        var oldStatus = Status;
        Status = status;
        Raise(new ProductStatusChanged(Uuid, oldStatus, status, occurredAt));
    }

    public void SetAvailableFrom(DateTimeOffset? availableFrom) => AvailableFrom = availableFrom;

    public void AssignToModel(Guid? modelUuid) => ModelUuid = modelUuid;

    public void SetImage(string? image) => Image = image;

    /// <summary>Ustawia atrybuty opisowe.</summary>
    public void SetAttributes(string weight, string color)
    {
        AttrWeight = weight ?? string.Empty;
        AttrColor = color ?? string.Empty;
    }

    /// <summary>Podmienia komplet kategorii produktu. Duplikaty są pomijane.</summary>
    public void SetCategories(IEnumerable<Guid> categoryUuids)
    {
        ArgumentNullException.ThrowIfNull(categoryUuids);

        _categories.Clear();
        foreach (var categoryUuid in categoryUuids.Distinct())
        {
            _categories.Add(new ProductCategoryLink(Uuid, categoryUuid));
        }
    }

    /// <summary>Podmienia komplet powiązanych multimediów.</summary>
    public void SetMultimedia(IEnumerable<Guid> multimediaUuids)
    {
        ArgumentNullException.ThrowIfNull(multimediaUuids);

        _multimedia.Clear();
        foreach (var multimediaUuid in multimediaUuids.Distinct())
        {
            _multimedia.Add(new ProductMultimediaLink(Uuid, multimediaUuid));
        }
    }

    /// <summary>Podmienia komplet gwarancji produktu.</summary>
    public void SetWarranties(IEnumerable<(Guid WarrantyUuid, int DurationMonths)> warranties)
    {
        ArgumentNullException.ThrowIfNull(warranties);

        _warranties.Clear();
        foreach (var (warrantyUuid, durationMonths) in warranties)
        {
            _warranties.Add(new ProductWarranty(Uuid, warrantyUuid, durationMonths));
        }
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("product_name_empty", "Nazwa produktu nie może być pusta.");
        }

        return name.Trim();
    }

    private static string ValidateSku(string sku)
    {
        if (string.IsNullOrWhiteSpace(sku))
        {
            throw new DomainException("product_sku_empty", "SKU produktu nie może być puste.");
        }

        return sku.Trim();
    }

    private static decimal ValidatePrice(decimal price)
    {
        if (price < 0)
        {
            throw new DomainException("product_price_negative", "Cena produktu nie może być ujemna.");
        }

        return price;
    }
}
