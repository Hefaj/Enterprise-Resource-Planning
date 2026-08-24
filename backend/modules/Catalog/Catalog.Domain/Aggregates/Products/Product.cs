using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Products;

/// <summary>
/// Produkt — główny agregat katalogu.
///
/// <para><b>Granica agregatu.</b> Wewnątrz są tylko byty, które nie mają sensu bez produktu:
/// przypisania kategorii, powiązania z multimediami, okresy gwarancji, nadane kody i wartości
/// atrybutów. Same kategorie, multimedia, modele, definicje gwarancji, typy kodów i definicje
/// atrybutów to osobne agregaty — produkt trzyma do nich wyłącznie identyfikatory, nigdy
/// referencje obiektowe. Dzięki temu wczytanie produktu nie wciąga za sobą pół katalogu,
/// a zmiana nazwy kategorii nie wymaga dotykania produktów.</para>
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
    private readonly List<ProductCode> _codes = [];
    private readonly List<ProductAttributeValue> _attributeValues = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    protected Product()
    {
    }

    private Product(Guid uuid, string name, decimal price) : base(uuid)
    {
        Name = name;
        Price = price;
        Status = ProductStatus.Draft;
    }

    public string Name { get; private set; } = string.Empty;

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

    /// <summary>Kody nadane produktowi — SKU, EAN i wszystko, co przyniesie słownik typów.</summary>
    public IReadOnlyCollection<ProductCode> Codes => _codes.AsReadOnly();

    /// <summary>Wartości atrybutów produktu.</summary>
    public IReadOnlyCollection<ProductAttributeValue> AttributeValues => _attributeValues.AsReadOnly();

    /// <summary>Identyfikatory kategorii, do których należy produkt.</summary>
    public IReadOnlyCollection<Guid> CategoryUuids
        => [.. _categories.Select(c => c.CategoryUuid)];

    /// <summary>Identyfikatory zasobów multimedialnych produktu.</summary>
    public IReadOnlyCollection<Guid> MultimediaUuids
        => [.. _multimedia.Select(m => m.MultimediaUuid)];

    /// <summary>Gwarancje przypisane do produktu wraz z faktycznym okresem.</summary>
    public IReadOnlyCollection<ProductWarranty> Warranties => _warranties.AsReadOnly();

    public static Product Create(string name, decimal price)
        => new(NewUuid(), ValidateName(name), ValidatePrice(price));

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static Product CreateWithUuid(Guid uuid, string name, decimal price)
        => new(uuid, ValidateName(name), ValidatePrice(price));

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

    /// <summary>
    /// Podmienia komplet kodów produktu.
    ///
    /// <para>Podmiana idzie po RÓŻNICY, a nie przez wyczyszczenie kolekcji — z tego samego
    /// powodu co przy kategoriach (patrz <see cref="ReplaceCategories"/>), plus jednego
    /// dodatkowego: kody typów unikalnych wchodzą do częściowego indeksu unikalnego, więc
    /// skasowanie i ponowne wstawienie tej samej wartości w jednym <c>SaveChanges</c>
    /// stawiałoby zapis w zależności od kolejności poleceń wygenerowanej przez EF.</para>
    ///
    /// <para>Duplikaty (ten sam typ i ta sama wartość) są pomijane; dwa różne kody tego samego
    /// typu są dozwolone — produkt bywa sprzedawany pod kilkoma EAN-ami.</para>
    /// </summary>
    public void SetCodes(IEnumerable<ProductCodeAssignment> codes)
    {
        ArgumentNullException.ThrowIfNull(codes);

        var target = new Dictionary<string, ProductCodeAssignment>(StringComparer.OrdinalIgnoreCase);
        foreach (var code in codes)
        {
            target[CodeSignature(code.CodeTypeUuid, code.Value)] = code;
        }

        _codes.RemoveAll(existing => !target.ContainsKey(CodeSignature(existing.CodeTypeUuid, existing.Value)));

        var current = _codes
            .Select(existing => CodeSignature(existing.CodeTypeUuid, existing.Value))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in target.Where(entry => !current.Contains(entry.Key)))
        {
            _codes.Add(new ProductCode(Uuid, entry.Value.CodeTypeUuid, entry.Value.Value, entry.Value.Unique));
        }
    }

    /// <summary>
    /// Podmienia komplet wartości atrybutów. Tak samo po różnicy jak <see cref="SetCodes"/>,
    /// i tak samo z powodu indeksu — atrybuty jednowartościowe mają unikalny indeks częściowy
    /// po (produkt, atrybut).
    ///
    /// <para>Spójność wartości z definicją atrybutu jest sprawdzona wcześniej: jedyną drogą
    /// do <see cref="ProductAttributeAssignment"/> są jego fabryki, a każda wymaga
    /// <c>AttributeDefinition</c>.</para>
    /// </summary>
    public void SetAttributeValues(IEnumerable<ProductAttributeAssignment> values)
    {
        ArgumentNullException.ThrowIfNull(values);

        var target = new Dictionary<string, ProductAttributeAssignment>(StringComparer.Ordinal);
        foreach (var value in values)
        {
            target[AttributeSignature(value)] = value;
        }

        _attributeValues.RemoveAll(existing => !target.ContainsKey(AttributeSignature(existing)));

        var current = _attributeValues.Select(AttributeSignature).ToHashSet(StringComparer.Ordinal);

        foreach (var entry in target.Where(entry => !current.Contains(entry.Key)))
        {
            _attributeValues.Add(new ProductAttributeValue(Uuid, entry.Value));
        }
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

    /// <summary>
    /// Dopina multimedia do produktu, zachowując te już przypisane.
    ///
    /// <para>Powtórzenia są pomijane po cichu, a nie odrzucane błędem: dopięcie pliku, który
    /// już przy produkcie wisi, kończy się dokładnie tym stanem, o który wołającemu chodziło.
    /// Przy operacji masowej na tysiącach produktów alternatywą byłoby wywracanie całych paczek
    /// przez pojedyncze przypisanie zrobione wcześniej ręcznie.</para>
    ///
    /// <para>Wymaga agregatu wczytanego w zakresie <c>Full</c> — na niewczytanej kolekcji
    /// sprawdzenie powtórzeń zobaczyłoby pustkę i dopisało drugi wiersz, a ten wywróciłby się
    /// dopiero na unikalnym indeksie <c>(product_uuid, multimedia_uuid)</c>.</para>
    /// </summary>
    public void AddMultimedia(IEnumerable<Guid> multimediaUuids)
    {
        ArgumentNullException.ThrowIfNull(multimediaUuids);

        var existing = new HashSet<Guid>(_multimedia.Select(m => m.MultimediaUuid));

        foreach (var multimediaUuid in multimediaUuids.Distinct())
        {
            if (existing.Add(multimediaUuid))
            {
                _multimedia.Add(new ProductMultimediaLink(Uuid, multimediaUuid));
            }
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

    /// <summary>Tożsamość kodu na potrzeby podmiany po różnicy — para (typ, wartość),
    /// bez uwzględniania wielkości liter, tak samo jak liczy ją
    /// <see cref="ProductCode.ComputeUniqueKey"/>.</summary>
    private static string CodeSignature(Guid codeTypeUuid, string value)
        => string.Create(CultureInfo.InvariantCulture, $"{codeTypeUuid:D}|{value.Trim()}");

    /// <summary>
    /// Tożsamość wartości atrybutu na potrzeby podmiany po różnicy: atrybut, pozycja i cała
    /// zawartość. Wartość jest w całości opisem, a nie bytem z własnym cyklem życia — „zmiana
    /// koloru z czarnego na biały” to usunięcie jednego wiersza i wstawienie drugiego,
    /// nie edycja. Dzięki temu porównanie nie musi zgadywać, która ze starych wartości
    /// odpowiada której nowej.
    /// </summary>
    private static string AttributeSignature(ProductAttributeAssignment value)
        => AttributeSignature(
            value.AttributeUuid, value.OptionUuid, value.MultimediaUuid,
            value.ValueText, value.ValueNumber, value.ValueBoolean, value.ValueDate, value.SortOrder);

    private static string AttributeSignature(ProductAttributeValue value)
        => AttributeSignature(
            value.AttributeUuid, value.OptionUuid, value.MultimediaUuid,
            value.ValueText, value.ValueNumber, value.ValueBoolean, value.ValueDate, value.SortOrder);

    private static string AttributeSignature(
        Guid attributeUuid,
        Guid? optionUuid,
        Guid? multimediaUuid,
        string? text,
        decimal? number,
        bool? boolean,
        DateTimeOffset? date,
        int sortOrder)
        => string.Create(
            CultureInfo.InvariantCulture,
            $"{attributeUuid:D}|{optionUuid:D}|{multimediaUuid:D}|{text}|{number}|{boolean}|{date:O}|{sortOrder}");

    private static decimal ValidatePrice(decimal price)
    {
        if (price < 0)
        {
            throw new DomainException("product_price_negative", "Cena produktu nie może być ujemna.");
        }

        return price;
    }
}
