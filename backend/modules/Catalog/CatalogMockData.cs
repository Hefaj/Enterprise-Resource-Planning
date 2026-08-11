using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Catalog;

public record CategoryDto(
    Guid Uuid,
    string Name,
    Guid? ParentUuid
);

public record ModelDto(
    Guid Uuid,
    string Name
);

public record ProductWarrantyDto(
    Guid WarrantyUuid,
    int DurationMonths
);

public record ProductDto(
    Guid Uuid,
    string Name,
    List<Guid> CategoryUuids,
    List<Guid> MultimediaUuids,
    List<ProductWarrantyDto> Warranties,
    Guid? ModelUuid,
    string Sku,
    decimal Price,
    DateTime? AvailableFrom,
    string Status,
    bool Available,
    string Ean,
    string? Image,
    string Attr_Weight = "2.1kg",
    string Attr_Color = "Space Gray"
);

public record MultimediaDto(
    Guid Uuid,
    string FileName,
    string MediaType,
    string? ThumbnailUrl,
    string OriginalUrl,
    long FileSize,
    string MimeType,
    int SortOrder,
    DateTime CreatedAt
);

public record WarrantyDto(
    Guid Uuid,
    string Name,
    int DurationMonths,
    string Description
);

public static class CatalogMockData
{
    public static List<CategoryDto> Categories { get; private set; } = new();
    public static List<ModelDto> Models { get; private set; } = new();
    public static List<ProductDto> Products { get; private set; } = new();
    public static List<MultimediaDto> Multimedias { get; private set; } = new();
    public static List<WarrantyDto> Warranties { get; private set; } = new();

    /// <summary>Indeks dzieci per rodzic (`null` = korzenie) — budowany raz razem z
    /// <see cref="Categories"/>. Przy tysiącach węzłów zastępuje liniowe skanowanie całej listy
    /// (`Categories.Where(c => c.ParentUuid == x)`) przy KAŻDYM zapytaniu — bez tego indeksu
    /// liczenie potomków węzła (<see cref="Category.CategoryTreeNodeMapper"/>) byłoby
    /// O(rozmiar poddrzewa × liczba wszystkich kategorii) zamiast O(rozmiar poddrzewa).</summary>
    public static ILookup<Guid?, CategoryDto> CategoryChildren { get; private set; } =
        Array.Empty<CategoryDto>().ToLookup(c => c.ParentUuid);

    /// <summary>Indeks kategorii po Uuid — budowany raz razem z <see cref="Categories"/>.</summary>
    public static Dictionary<Guid, CategoryDto> CategoryByUuid { get; private set; } = new();

    static CatalogMockData()
    {
        GenerateData(1500, 15);
    }

    private static readonly Random DelayRandom = new();

    /// <summary>Symuluje opóźnienie sieci/bazy danych dla endpointów Query mock-backendu.</summary>
    public static Task SimulateQueryDelayAsync(CancellationToken ct, int minMs = 200, int maxMs = 800)
        => Task.Delay(DelayRandom.Next(minMs, maxMs), ct);

    public static void GenerateData(int productCount, int modelCount)
    {
        var random = new Random();

        Categories = GenerateCategories(out var productAssignableCategories);
        CategoryChildren = Categories.ToLookup(c => c.ParentUuid);
        CategoryByUuid = Categories.ToDictionary(c => c.Uuid);

        Models = GenerateModels(modelCount);
        Multimedias.Clear();
        Warranties = GenerateWarranties(150);
        // Produkty łapią kategorie tylko z ręcznie nazwanej (czytelnej) części drzewa —
        // masowo wygenerowana część (patrz GenerateLargeSyntheticSubtree) istnieje wyłącznie
        // do testowania stronicowania/wirtualizacji drzewa kategorii, nie do tagowania produktów
        // (inaczej lista produktów zalałoby się nazwami w stylu "Pozycja testowa 3.12.7").
        Products = GenerateProducts(productCount, productAssignableCategories, Models, random);
    }

    private static List<WarrantyDto> GenerateWarranties(int count)
    {
        var list = new List<WarrantyDto>();
        for (int i = 0; i < count; i++)
        {
            list.Add(new WarrantyDto(Guid.NewGuid(), $"Gwarancja {i + 1}", (i % 3 + 1) * 12, $"Opis gwarancji {i + 1}"));
        }
        return list;
    }

    /// <summary>Węzeł "przepisu" hierarchii kategorii — wyłącznie do zasilenia <see cref="GenerateCategories"/>,
    /// nie ma odpowiednika w API (nie ma tu Uuid — nadawany dopiero przy spłaszczaniu drzewa).</summary>
    private sealed class CategorySeed
    {
        public required string Name { get; init; }
        public CategorySeed[]? Children { get; init; }
    }

    /// <summary>Stała hierarchia kategorii katalogu — odpowiednik `MOCK_TREE` z (usuniętego po
    /// tej migracji) frontendowego `category-tree.mock-data.ts`. Jedyne miejsce prawdy dla tych
    /// przykładowych nazw kategorii.</summary>
    private static readonly CategorySeed[] CategoryTreeSeed =
    [
        new CategorySeed
        {
            Name = "Elektronika",
            Children =
            [
                new CategorySeed
                {
                    Name = "AGD",
                    Children =
                    [
                        new CategorySeed { Name = "Duże AGD", Children = [new CategorySeed { Name = "Pralki" }, new CategorySeed { Name = "Zmywarki" }, new CategorySeed { Name = "Lodówki" }, new CategorySeed { Name = "Piekarniki" }] },
                        new CategorySeed { Name = "Małe AGD", Children = [new CategorySeed { Name = "Czajniki" }, new CategorySeed { Name = "Blendery" }, new CategorySeed { Name = "Ekspresy do kawy" }, new CategorySeed { Name = "Roboty kuchenne" }] },
                    ],
                },
                new CategorySeed
                {
                    Name = "RTV",
                    Children = [new CategorySeed { Name = "Telewizory" }, new CategorySeed { Name = "Głośniki" }, new CategorySeed { Name = "Soundbary" }, new CategorySeed { Name = "Amplitunery" }],
                },
                new CategorySeed
                {
                    Name = "Komputery",
                    Children =
                    [
                        new CategorySeed { Name = "Laptopy" },
                        new CategorySeed { Name = "Komputery stacjonarne" },
                        new CategorySeed { Name = "Monitory" },
                        new CategorySeed { Name = "Podzespoły", Children = [new CategorySeed { Name = "Procesory" }, new CategorySeed { Name = "Karty graficzne" }, new CategorySeed { Name = "Pamięć RAM" }, new CategorySeed { Name = "Dyski SSD" }] },
                    ],
                },
                new CategorySeed { Name = "Telefony i tablety", Children = [new CategorySeed { Name = "Smartfony" }, new CategorySeed { Name = "Tablety" }, new CategorySeed { Name = "Akcesoria do telefonów" }] },
            ],
        },
        new CategorySeed
        {
            Name = "Odzież",
            Children =
            [
                new CategorySeed { Name = "Odzież męska", Children = [new CategorySeed { Name = "Koszule" }, new CategorySeed { Name = "Spodnie" }, new CategorySeed { Name = "Kurtki" }, new CategorySeed { Name = "Bielizna męska" }] },
                new CategorySeed { Name = "Odzież damska", Children = [new CategorySeed { Name = "Sukienki" }, new CategorySeed { Name = "Bluzki" }, new CategorySeed { Name = "Spódnice" }, new CategorySeed { Name = "Bielizna damska" }] },
                new CategorySeed { Name = "Odzież dziecięca", Children = [new CategorySeed { Name = "Niemowlęca" }, new CategorySeed { Name = "Dla przedszkolaków" }, new CategorySeed { Name = "Dla nastolatków" }] },
                new CategorySeed { Name = "Obuwie", Children = [new CategorySeed { Name = "Obuwie sportowe" }, new CategorySeed { Name = "Obuwie eleganckie" }, new CategorySeed { Name = "Kapcie" }] },
            ],
        },
        new CategorySeed
        {
            Name = "Dom i Ogród",
            Children =
            [
                new CategorySeed { Name = "Meble", Children = [new CategorySeed { Name = "Meble do salonu" }, new CategorySeed { Name = "Meble do sypialni" }, new CategorySeed { Name = "Meble ogrodowe" }] },
                new CategorySeed { Name = "Oświetlenie", Children = [new CategorySeed { Name = "Lampy sufitowe" }, new CategorySeed { Name = "Lampy stołowe" }, new CategorySeed { Name = "Taśmy LED" }] },
                new CategorySeed { Name = "Ogród", Children = [new CategorySeed { Name = "Narzędzia ogrodowe" }, new CategorySeed { Name = "Meble ogrodowe" }, new CategorySeed { Name = "Nawadnianie" }] },
                new CategorySeed { Name = "Tekstylia domowe", Children = [new CategorySeed { Name = "Pościel" }, new CategorySeed { Name = "Ręczniki" }, new CategorySeed { Name = "Zasłony" }] },
            ],
        },
        new CategorySeed
        {
            Name = "Narzędzia",
            Children =
            [
                new CategorySeed { Name = "Elektronarzędzia", Children = [new CategorySeed { Name = "Wiertarki" }, new CategorySeed { Name = "Szlifierki" }, new CategorySeed { Name = "Piły" }] },
                new CategorySeed { Name = "Narzędzia ręczne", Children = [new CategorySeed { Name = "Klucze" }, new CategorySeed { Name = "Śrubokręty" }, new CategorySeed { Name = "Młotki" }] },
                new CategorySeed { Name = "Pomiary", Children = [new CategorySeed { Name = "Miary" }, new CategorySeed { Name = "Poziomice" }, new CategorySeed { Name = "Mierniki laserowe" }] },
            ],
        },
        new CategorySeed
        {
            Name = "Biuro i Papeteria",
            Children =
            [
                new CategorySeed { Name = "Artykuły piśmienne" },
                new CategorySeed { Name = "Papier i druk" },
                new CategorySeed { Name = "Meble biurowe", Children = [new CategorySeed { Name = "Krzesła biurowe" }, new CategorySeed { Name = "Biurka" }] },
            ],
        },
        new CategorySeed
        {
            Name = "Motoryzacja",
            Children =
            [
                new CategorySeed { Name = "Części samochodowe", Children = [new CategorySeed { Name = "Filtry" }, new CategorySeed { Name = "Hamulce" }, new CategorySeed { Name = "Oleje i płyny" }] },
                new CategorySeed { Name = "Akcesoria samochodowe", Children = [new CategorySeed { Name = "Dywaniki" }, new CategorySeed { Name = "Pokrowce" }, new CategorySeed { Name = "Nawigacje" }] },
            ],
        },
        new CategorySeed
        {
            Name = "Sport i Rekreacja",
            Children =
            [
                new CategorySeed { Name = "Rowery", Children = [new CategorySeed { Name = "Rowery górskie" }, new CategorySeed { Name = "Rowery szosowe" }, new CategorySeed { Name = "Akcesoria rowerowe" }] },
                new CategorySeed { Name = "Fitness", Children = [new CategorySeed { Name = "Hantle" }, new CategorySeed { Name = "Maty" }, new CategorySeed { Name = "Ekspandery" }] },
                new CategorySeed { Name = "Turystyka", Children = [new CategorySeed { Name = "Namioty" }, new CategorySeed { Name = "Śpiwory" }, new CategorySeed { Name = "Plecaki" }] },
            ],
        },
    ];

    private static List<CategoryDto> GenerateCategories(out List<CategoryDto> productAssignableCategories)
    {
        var list = new List<CategoryDto>();

        void Flatten(IEnumerable<CategorySeed> nodes, Guid? parentUuid)
        {
            foreach (var node in nodes)
            {
                var uuid = Guid.NewGuid();
                list.Add(new CategoryDto(uuid, node.Name, parentUuid));
                if (node.Children != null)
                    Flatten(node.Children, uuid);
            }
        }

        Flatten(CategoryTreeSeed, null);
        // Snapshot PRZED dołożeniem masowej gałęzi testowej — tylko to ma sensowne, czytelne
        // nazwy nadające się do wyświetlenia jako kategoria produktu.
        productAssignableCategories = new List<CategoryDto>(list);

        Flatten([GenerateLargeSyntheticSubtree()], null);

        return list;
    }

    /// <summary>
    /// Generuje dużą, w pełni sztuczną gałąź drzewa kategorii — wyłącznie do testowania
    /// stronicowania/wirtualizacji `erp-tree` w trybie server przy tysiącach węzłów (czego
    /// ręcznie nazwana część <see cref="CategoryTreeSeed"/>, ~90 węzłów, nie jest w stanie
    /// zweryfikować). Środkowy poziom (60 dzieci na węzeł) świadomie przekracza domyślny
    /// `GetCategoryChildrenRequest.PageSize` (50), więc wymusza scenariusz "load more" —
    /// nie tylko listę mieszczącą się w całości na pierwszej stronie.
    /// </summary>
    private static CategorySeed GenerateLargeSyntheticSubtree()
    {
        const int level1Count = 5;
        const int level2Count = 60;
        const int level3Count = 30;

        CategorySeed[] BuildLeaves(string pathPrefix)
        {
            var leaves = new CategorySeed[level3Count];
            for (var k = 1; k <= level3Count; k++)
            {
                leaves[k - 1] = new CategorySeed { Name = $"Pozycja testowa {pathPrefix}.{k}" };
            }
            return leaves;
        }

        CategorySeed[] BuildLevel2(string pathPrefix)
        {
            var nodes = new CategorySeed[level2Count];
            for (var j = 1; j <= level2Count; j++)
            {
                var path = $"{pathPrefix}.{j}";
                nodes[j - 1] = new CategorySeed { Name = $"Podgrupa testowa {path}", Children = BuildLeaves(path) };
            }
            return nodes;
        }

        var level1 = new CategorySeed[level1Count];
        for (var i = 1; i <= level1Count; i++)
        {
            var path = $"{i}";
            level1[i - 1] = new CategorySeed { Name = $"Grupa testowa {path}", Children = BuildLevel2(path) };
        }

        return new CategorySeed
        {
            Name = $"Struktura testowa ({level1Count * level2Count * level3Count:N0}+ pozycji)",
            Children = level1,
        };
    }

    private static List<ModelDto> GenerateModels(int count)
    {
        var list = new List<ModelDto>();
        for (int i = 0; i < count; i++)
        {
            list.Add(new ModelDto(Guid.NewGuid(), $"Model {i + 1}"));
        }
        return list;
    }

    private static List<ProductDto> GenerateProducts(int count, List<CategoryDto> categories, List<ModelDto> models, Random random)
    {
        var list = new List<ProductDto>();
        for (int i = 0; i < count; i++)
        {
            var numCategories = random.Next(1, Math.Min(4, categories.Count + 1));
            var productCategories = categories.OrderBy(x => random.Next()).Take(numCategories).Select(x => x.Uuid).ToList();
            
            var assignModel = random.NextDouble() > 0.3;
            Guid? modelUuid = assignModel && models.Any() ? models[random.Next(models.Count)].Uuid : null;

            var active = random.NextDouble() > 0.2;

            var multimediaCount = random.Next(0, 5);
            var multimediaUuids = Enumerable.Range(0, multimediaCount).Select(_ => Guid.NewGuid()).ToList();
            
            for (int j = 0; j < multimediaCount; j++)
            {
                Multimedias.Add(new MultimediaDto(
                    multimediaUuids[j],
                    $"File {j + 1} for Produkt {i + 1}.jpg",
                    "image",
                    "https://picsum.photos/200",
                    "https://picsum.photos/800",
                    random.Next(100000, 5000000),
                    "image/jpeg",
                    j,
                    DateTime.Now.AddDays(-random.Next(1, 30))
                ));
            }

            var hasManyWarranties = i < 5 || random.NextDouble() > 0.95;
            var numWarranties = hasManyWarranties ? random.Next(50, 101) : random.Next(0, 3);
            Console.WriteLine($"i={i}, numWarranties={numWarranties}, Warranties.Count={Warranties.Count}");
            var productWarranties = Warranties.OrderBy(x => random.Next()).Take(numWarranties)
                .Select(w => new ProductWarrantyDto(
                    w.Uuid,
                    // W promocji gwarancja bywa wydłużona względem standardowego okresu z katalogu gwarancji
                    random.NextDouble() > 0.8 ? w.DurationMonths * 2 : w.DurationMonths
                ))
                .ToList();

            list.Add(new ProductDto(
                Guid.NewGuid(),
                $"Produkt {i + 1}",
                productCategories,
                multimediaUuids,
                productWarranties,
                modelUuid,
                $"SKU-{i + 1:D5}",
                (decimal)Math.Round(random.NextDouble() * 10000 + 10, 2),
                DateTime.Now.AddDays(-random.Next(1, 365)),
                active ? "Aktywny" : "Draft",
                active,
                $"590{random.Next(100000000, 999999999)}",
                null,
                $"{(random.NextDouble() * 10):F1}kg",
                random.NextDouble() > 0.5 ? "Czarny" : "Biały"
            ));
        }
        return list;
    }
}
