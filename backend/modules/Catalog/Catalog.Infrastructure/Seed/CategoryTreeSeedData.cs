namespace Catalog.Infrastructure.Seed;

/// <summary>Węzeł "przepisu" hierarchii kategorii — identyfikatory nadawane są dopiero
/// przy spłaszczaniu drzewa przez seeder.</summary>
internal sealed class CategorySeedNode
{
    public required string Name { get; init; }

    public CategorySeedNode[]? Children { get; init; }
}

/// <summary>
/// Stała hierarchia kategorii katalogu — jedyne miejsce prawdy dla przykładowych nazw.
/// Przeniesiona 1:1 z <c>CatalogMockData.CategoryTreeSeed</c>, żeby dane widziane przez frontend
/// nie zmieniły się przy migracji z mocków na Postgresa.
///
/// Produkty dostają kategorie WYŁĄCZNIE z tej, ręcznie nazwanej części drzewa — gałąź
/// syntetyczna (patrz <see cref="CategoryTreeProfile"/>) służy testom wirtualizacji, a nie
/// tagowaniu produktów, inaczej lista produktów zalałaby się nazwami „Pozycja testowa 3.12.7”.
/// </summary>
internal static class CategoryTreeSeedData
{
    internal static readonly CategorySeedNode[] NamedTree =
    [
        new CategorySeedNode
        {
            Name = "Elektronika",
            Children =
            [
                new CategorySeedNode
                {
                    Name = "AGD",
                    Children =
                    [
                        new CategorySeedNode { Name = "Duże AGD", Children = [new CategorySeedNode { Name = "Pralki" }, new CategorySeedNode { Name = "Zmywarki" }, new CategorySeedNode { Name = "Lodówki" }, new CategorySeedNode { Name = "Piekarniki" }] },
                        new CategorySeedNode { Name = "Małe AGD", Children = [new CategorySeedNode { Name = "Czajniki" }, new CategorySeedNode { Name = "Blendery" }, new CategorySeedNode { Name = "Ekspresy do kawy" }, new CategorySeedNode { Name = "Roboty kuchenne" }] },
                    ],
                },
                new CategorySeedNode
                {
                    Name = "RTV",
                    Children = [new CategorySeedNode { Name = "Telewizory" }, new CategorySeedNode { Name = "Głośniki" }, new CategorySeedNode { Name = "Soundbary" }, new CategorySeedNode { Name = "Amplitunery" }],
                },
                new CategorySeedNode
                {
                    Name = "Komputery",
                    Children =
                    [
                        new CategorySeedNode { Name = "Laptopy" },
                        new CategorySeedNode { Name = "Komputery stacjonarne" },
                        new CategorySeedNode { Name = "Monitory" },
                        new CategorySeedNode { Name = "Podzespoły", Children = [new CategorySeedNode { Name = "Procesory" }, new CategorySeedNode { Name = "Karty graficzne" }, new CategorySeedNode { Name = "Pamięć RAM" }, new CategorySeedNode { Name = "Dyski SSD" }] },
                    ],
                },
                new CategorySeedNode { Name = "Telefony i tablety", Children = [new CategorySeedNode { Name = "Smartfony" }, new CategorySeedNode { Name = "Tablety" }, new CategorySeedNode { Name = "Akcesoria do telefonów" }] },
            ],
        },
        new CategorySeedNode
        {
            Name = "Odzież",
            Children =
            [
                new CategorySeedNode { Name = "Odzież męska", Children = [new CategorySeedNode { Name = "Koszule" }, new CategorySeedNode { Name = "Spodnie" }, new CategorySeedNode { Name = "Kurtki" }, new CategorySeedNode { Name = "Bielizna męska" }] },
                new CategorySeedNode { Name = "Odzież damska", Children = [new CategorySeedNode { Name = "Sukienki" }, new CategorySeedNode { Name = "Bluzki" }, new CategorySeedNode { Name = "Spódnice" }, new CategorySeedNode { Name = "Bielizna damska" }] },
                new CategorySeedNode { Name = "Odzież dziecięca", Children = [new CategorySeedNode { Name = "Niemowlęca" }, new CategorySeedNode { Name = "Dla przedszkolaków" }, new CategorySeedNode { Name = "Dla nastolatków" }] },
                new CategorySeedNode { Name = "Obuwie", Children = [new CategorySeedNode { Name = "Obuwie sportowe" }, new CategorySeedNode { Name = "Obuwie eleganckie" }, new CategorySeedNode { Name = "Kapcie" }] },
            ],
        },
        new CategorySeedNode
        {
            Name = "Dom i Ogród",
            Children =
            [
                new CategorySeedNode { Name = "Meble", Children = [new CategorySeedNode { Name = "Meble do salonu" }, new CategorySeedNode { Name = "Meble do sypialni" }, new CategorySeedNode { Name = "Meble ogrodowe" }] },
                new CategorySeedNode { Name = "Oświetlenie", Children = [new CategorySeedNode { Name = "Lampy sufitowe" }, new CategorySeedNode { Name = "Lampy stołowe" }, new CategorySeedNode { Name = "Taśmy LED" }] },
                new CategorySeedNode { Name = "Ogród", Children = [new CategorySeedNode { Name = "Narzędzia ogrodowe" }, new CategorySeedNode { Name = "Meble ogrodowe" }, new CategorySeedNode { Name = "Nawadnianie" }] },
                new CategorySeedNode { Name = "Tekstylia domowe", Children = [new CategorySeedNode { Name = "Pościel" }, new CategorySeedNode { Name = "Ręczniki" }, new CategorySeedNode { Name = "Zasłony" }] },
            ],
        },
        new CategorySeedNode
        {
            Name = "Narzędzia",
            Children =
            [
                new CategorySeedNode { Name = "Elektronarzędzia", Children = [new CategorySeedNode { Name = "Wiertarki" }, new CategorySeedNode { Name = "Szlifierki" }, new CategorySeedNode { Name = "Piły" }] },
                new CategorySeedNode { Name = "Narzędzia ręczne", Children = [new CategorySeedNode { Name = "Klucze" }, new CategorySeedNode { Name = "Śrubokręty" }, new CategorySeedNode { Name = "Młotki" }] },
                new CategorySeedNode { Name = "Pomiary", Children = [new CategorySeedNode { Name = "Miary" }, new CategorySeedNode { Name = "Poziomice" }, new CategorySeedNode { Name = "Mierniki laserowe" }] },
            ],
        },
        new CategorySeedNode
        {
            Name = "Biuro i Papeteria",
            Children =
            [
                new CategorySeedNode { Name = "Artykuły piśmienne" },
                new CategorySeedNode { Name = "Papier i druk" },
                new CategorySeedNode { Name = "Meble biurowe", Children = [new CategorySeedNode { Name = "Krzesła biurowe" }, new CategorySeedNode { Name = "Biurka" }] },
            ],
        },
        new CategorySeedNode
        {
            Name = "Motoryzacja",
            Children =
            [
                new CategorySeedNode { Name = "Części samochodowe", Children = [new CategorySeedNode { Name = "Filtry" }, new CategorySeedNode { Name = "Hamulce" }, new CategorySeedNode { Name = "Oleje i płyny" }] },
                new CategorySeedNode { Name = "Akcesoria samochodowe", Children = [new CategorySeedNode { Name = "Dywaniki" }, new CategorySeedNode { Name = "Pokrowce" }, new CategorySeedNode { Name = "Nawigacje" }] },
            ],
        },
        new CategorySeedNode
        {
            Name = "Sport i Rekreacja",
            Children =
            [
                new CategorySeedNode { Name = "Rowery", Children = [new CategorySeedNode { Name = "Rowery górskie" }, new CategorySeedNode { Name = "Rowery szosowe" }, new CategorySeedNode { Name = "Akcesoria rowerowe" }] },
                new CategorySeedNode { Name = "Fitness", Children = [new CategorySeedNode { Name = "Hantle" }, new CategorySeedNode { Name = "Maty" }, new CategorySeedNode { Name = "Ekspandery" }] },
                new CategorySeedNode { Name = "Turystyka", Children = [new CategorySeedNode { Name = "Namioty" }, new CategorySeedNode { Name = "Śpiwory" }, new CategorySeedNode { Name = "Plecaki" }] },
            ],
        },
    ];
}
