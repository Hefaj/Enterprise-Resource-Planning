using System.Globalization;
using System.Security.Cryptography;
using System.Text;
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

    /// <summary>
    /// Sygnatura duplikatu — skrót z modelu i kompletu kategorii, na którym stoi unikalny
    /// indeks w bazie. Kolumna trwała, a nie właściwość wyliczana, bo o to właśnie chodzi:
    /// reguła „ten sam model i te same kategorie” dotyczy zbioru wierszy z tabeli podrzędnej,
    /// więc nie da się jej wyrazić zwykłym indeksem unikalnym po kolumnach produktu.
    ///
    /// <para><c>null</c> oznacza „nie uczestniczy w regule” (produkt bez modelu). Indeks jest
    /// częściowy, a Postgres i tak traktuje NULL-e jako różne, więc takie produkty nigdy
    /// ze sobą nie kolidują — nie potrzeba wartości-wartownika.</para>
    ///
    /// <para>Pole jest utrzymywane wyłącznie przez <see cref="RefreshDuplicateKey"/>, wołane
    /// z każdej metody zmieniającej model albo kategorie. Ręczne ustawianie go z zewnątrz
    /// oznaczałoby możliwość zapisania sygnatury niezgodnej ze stanem agregatu.</para>
    /// </summary>
    public string? DuplicateKey { get; private set; }

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

    public void AssignToModel(Guid? modelUuid)
    {
        ModelUuid = modelUuid;
        RefreshDuplicateKey();
    }

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

        ReplaceCategories(categoryUuids.Distinct());

        RefreshDuplicateKey();
    }

    /// <summary>
    /// Doprowadza kolekcję kategorii do zadanego zbioru, usuwając i dodając WYŁĄCZNIE różnicę.
    ///
    /// <para>Nie „wyczyść i dodaj wszystko od nowa”, mimo że to krótsze. Powód jest praktyczny:
    /// dla encji owned wyczyszczenie kolekcji i ponowne wstawienie tego samego klucza
    /// (<c>ProductUuid</c> + <c>CategoryUuid</c>) daje w ChangeTrackerze wpis skasowany i wpis
    /// dodany o tym samym kluczu — EF rozstrzyga to kasowaniem, a wstawienia nie wykonuje.
    /// Efektem jest zapis, który „się udaje”, po cichu gubiąc przypisania kategorii.</para>
    ///
    /// <para>Przy okazji: kategorie, które się nie zmieniły, nie generują żadnego ruchu w bazie,
    /// więc podmiana jednej kategorii z trzydziestu kosztuje jeden DELETE i jeden INSERT,
    /// a nie trzydzieści.</para>
    /// </summary>
    private void ReplaceCategories(IEnumerable<Guid> categoryUuids)
    {
        var target = categoryUuids.ToHashSet();

        _categories.RemoveAll(link => !target.Contains(link.CategoryUuid));

        var current = _categories.Select(link => link.CategoryUuid).ToHashSet();

        foreach (var categoryUuid in target.Where(uuid => !current.Contains(uuid)))
        {
            _categories.Add(new ProductCategoryLink(Uuid, categoryUuid));
        }
    }

    /// <summary>
    /// Ustawia klasyfikację produktu — model i komplet kategorii — jedną operacją.
    ///
    /// <para>Razem, a nie dwiema metodami, bo obie wartości składają się na
    /// <see cref="DuplicateKey"/>: przy rozdzieleniu istniałby moment z nowym modelem
    /// i starymi kategoriami, czyli sygnaturą, o którą nikt nie prosił, a która i tak
    /// musiałaby przejść przez unikalny indeks.</para>
    ///
    /// <para>Bez zmiany, gdy klasyfikacja jest identyczna — wtedy nie powstaje zdarzenie
    /// ani wpis w ChangeTrackerze, więc nie generuje się pusty ruch po SignalR
    /// (tak samo jak <see cref="SetName"/> i <see cref="SetPrice"/>).</para>
    /// </summary>
    public void SetClassification(Guid? modelUuid, IEnumerable<Guid> categoryUuids, DateTimeOffset occurredAt)
    {
        ArgumentNullException.ThrowIfNull(categoryUuids);

        // Materializacja przed jakąkolwiek zmianą stanu: wywołujący może podać leniwe
        // zapytanie, a wyliczenie go w połowie mutacji dałoby stan zależny od kolejności.
        var newCategories = categoryUuids.Distinct().ToList();

        var currentCategories = _categories.Select(c => c.CategoryUuid).ToHashSet();

        if (ModelUuid == modelUuid && currentCategories.SetEquals(newCategories))
        {
            return;
        }

        var oldModelUuid = ModelUuid;
        var oldCategories = CategoryUuids;

        ModelUuid = modelUuid;

        ReplaceCategories(newCategories);

        RefreshDuplicateKey();

        Raise(new ProductClassificationChanged(
            Uuid, oldModelUuid, modelUuid, oldCategories, CategoryUuids, occurredAt));
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

    /// <summary>
    /// Liczy sygnaturę duplikatu dla podanej klasyfikacji. Publiczna i statyczna, bo jest
    /// JEDYNYM źródłem prawdy o kształcie klucza: woła ją agregat przy zapisie, reguła wsadowa
    /// przy pre-checku i backfill przy migracji. Gdyby którekolwiek z tych miejsc liczyło klucz
    /// po swojemu, pre-check odpytywałby bazę o sygnatury, których zapis nigdy nie wygeneruje.
    ///
    /// <para>Skrót, a nie surowy string: produkt w kilkudziesięciu kategoriach dałby ponad
    /// kilobajt, a wpis w indeksie btree Postgresa nie mieści się powyżej ~2,7 kB.
    /// SHA-256 jest stabilny między procesami i wersjami runtime'u — <c>string.GetHashCode</c>
    /// nie jest (losowanie ziarna per proces), więc klucz zapisany dziś nie zgadzałby się
    /// z policzonym po restarcie.</para>
    /// </summary>
    /// <param name="modelUuid">Model produktu; <c>null</c> wyłącza produkt z reguły.</param>
    /// <param name="categoryUuids">Kategorie produktu — kolejność i powtórzenia bez znaczenia.</param>
    /// <returns>64-znakowy skrót heksadecymalny albo <c>null</c> dla produktu bez modelu.</returns>
    public static string? ComputeDuplicateKey(Guid? modelUuid, IEnumerable<Guid> categoryUuids)
    {
        ArgumentNullException.ThrowIfNull(categoryUuids);

        if (modelUuid is null)
        {
            return null;
        }

        // Sortowanie i odsianie powtórzeń są częścią definicji: „ten sam zbiór kategorii”
        // ma znaczyć to samo niezależnie od tego, w jakiej kolejności przyszły w komendzie.
        var normalizedCategories = string.Join(
            ',',
            categoryUuids.Distinct().Select(c => c.ToString("D", CultureInfo.InvariantCulture)).Order(StringComparer.Ordinal));

        var payload = string.Create(
            CultureInfo.InvariantCulture,
            $"{modelUuid.Value:D}|{normalizedCategories}");

        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(payload)));
    }

    /// <summary>Przelicza <see cref="DuplicateKey"/> z aktualnego stanu agregatu.</summary>
    private void RefreshDuplicateKey()
        => DuplicateKey = ComputeDuplicateKey(ModelUuid, _categories.Select(c => c.CategoryUuid));

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
