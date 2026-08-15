using Catalog.Domain.Attributes;
using Catalog.Domain.Codes;
using Catalog.Domain.Models;
using Catalog.Domain.Multimedia;
using Catalog.Domain.Products;
using Catalog.Domain.Warranties;
using Catalog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Catalog.Infrastructure.Seed;

/// <summary>
/// Zasila bazę danymi przykładowymi — następca <c>CatalogMockData</c>, z tą różnicą, że dane
/// lądują w Postgresie zamiast w statycznej liście w pamięci procesu.
///
/// <para><b>Idempotentny</b>: jeśli tabela kategorii nie jest pusta, seeder nie robi nic.
/// Dzięki temu może wisieć w starcie aplikacji bez ryzyka, że restart zduplikuje dane.</para>
///
/// <para><b>Deterministyczny</b>: wszystkie identyfikatory i wartości pochodzą z generatora
/// o stałym ziarnie (<see cref="CatalogSeedOptions.RandomSeed"/>), więc po każdym resecie bazy
/// „Produkt 42” ma ten sam Uuid. Poprzednia wersja losowała <c>Guid.NewGuid()</c> przy każdym
/// starcie procesu, co przy realnej bazie oznaczałoby, że żaden zapisany link ani test oparty
/// na konkretnym rekordzie nie przeżywa restartu.</para>
/// </summary>
public sealed partial class CatalogSeeder
{
    private readonly CatalogDbContext _dbContext;
    private readonly CategoryClosureMaintainer _closureMaintainer;
    private readonly CatalogSeedOptions _options;
    private readonly ILogger<CatalogSeeder> _logger;

    public CatalogSeeder(
        CatalogDbContext dbContext,
        CategoryClosureMaintainer closureMaintainer,
        CatalogSeedOptions options,
        ILogger<CatalogSeeder> logger)
    {
        _dbContext = dbContext;
        _closureMaintainer = closureMaintainer;
        _options = options;
        _logger = logger;
    }

    /// <summary>Zasila bazę, o ile jest pusta.</summary>
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await _dbContext.Categories.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            LogSeedSkipped(_logger);
            return;
        }

        var random = new Random(_options.RandomSeed);

        var categories = BuildCategories(random, out var assignableCategoryUuids);
        LogInsertingCategories(_logger, categories.Count);
        await BulkInsertCategoriesAsync(categories, cancellationToken).ConfigureAwait(false);

        LogRebuildingClosure(_logger);
        await _closureMaintainer.RebuildAllAsync(cancellationToken).ConfigureAwait(false);

        var models = BuildModels(random);
        var warranties = BuildWarranties(random);
        var codeTypes = BuildCodeTypes(random);
        var attributes = BuildAttributes(random);
        _dbContext.ProductModels.AddRange(models);
        _dbContext.Warranties.AddRange(warranties);
        _dbContext.CodeTypes.AddRange(codeTypes);
        _dbContext.AttributeDefinitions.AddRange(attributes);
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var (products, multimedia) = BuildProducts(
            random, assignableCategoryUuids, models, warranties, codeTypes, attributes);
        _dbContext.MultimediaAssets.AddRange(multimedia);
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // Produkty partiami — jeden SaveChanges na 1500 agregatów z kolekcjami wewnętrznymi
        // buduje ogromny graf w ChangeTrackerze i niepotrzebnie obciąża pamięć.
        const int batchSize = 250;
        for (var offset = 0; offset < products.Count; offset += batchSize)
        {
            _dbContext.Products.AddRange(products.Skip(offset).Take(batchSize));
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            _dbContext.ChangeTracker.Clear();
        }

        LogSeedCompleted(
            _logger, categories.Count, products.Count, models.Count, warranties.Count, multimedia.Count);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Katalog zawiera już dane — seed pominięty.")]
    private static partial void LogSeedSkipped(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Seed: {Count} kategorii…")]
    private static partial void LogInsertingCategories(ILogger logger, int count);

    [LoggerMessage(EventId = 3, Level = LogLevel.Information, Message = "Seed: przebudowa tabeli domknięcia…")]
    private static partial void LogRebuildingClosure(ILogger logger);

    [LoggerMessage(EventId = 4, Level = LogLevel.Information,
        Message = "Seed zakończony: {Categories} kategorii, {Products} produktów, {Models} modeli, {Warranties} gwarancji, {Multimedia} multimediów.")]
    private static partial void LogSeedCompleted(
        ILogger logger, int categories, int products, int models, int warranties, int multimedia);

    // ── Kategorie ──────────────────────────────────────────────────────────────

    private List<(Guid Uuid, string Name, Guid? ParentUuid)> BuildCategories(
        Random random,
        out List<Guid> assignableCategoryUuids)
    {
        var flat = new List<(Guid Uuid, string Name, Guid? ParentUuid)>();

        void Flatten(IEnumerable<CategorySeedNode> nodes, Guid? parentUuid)
        {
            foreach (var node in nodes)
            {
                var uuid = NextUuid(random);
                flat.Add((uuid, node.Name, parentUuid));
                if (node.Children is not null)
                {
                    Flatten(node.Children, uuid);
                }
            }
        }

        Flatten(CategoryTreeSeedData.NamedTree, null);

        // Snapshot PRZED gałęzią syntetyczną — tylko te kategorie mają czytelne nazwy
        // nadające się do pokazania jako kategoria produktu.
        assignableCategoryUuids = [.. flat.Select(c => c.Uuid)];

        var syntheticRoot = BuildSyntheticSubtree(_options.TreeProfile);
        if (syntheticRoot is not null)
        {
            Flatten([syntheticRoot], null);
        }

        return flat;
    }

    private static CategorySeedNode? BuildSyntheticSubtree(CategoryTreeProfile profile)
    {
        var (level1, level2, level3) = profile switch
        {
            CategoryTreeProfile.Small => (50, 600, 5),
            CategoryTreeProfile.Stress => (50, 600, 300),
            _ => (0, 0, 0),
        };

        if (level1 == 0)
        {
            return null;
        }

        CategorySeedNode[] BuildLeaves(string path)
        {
            var leaves = new CategorySeedNode[level3];
            for (var k = 1; k <= level3; k++)
            {
                leaves[k - 1] = new CategorySeedNode { Name = $"Pozycja testowa {path}.{k}" };
            }

            return leaves;
        }

        CategorySeedNode[] BuildLevel2(string path)
        {
            var nodes = new CategorySeedNode[level2];
            for (var j = 1; j <= level2; j++)
            {
                var childPath = $"{path}.{j}";
                nodes[j - 1] = new CategorySeedNode
                {
                    Name = $"Podgrupa testowa {childPath}",
                    Children = BuildLeaves(childPath),
                };
            }

            return nodes;
        }

        var roots = new CategorySeedNode[level1];
        for (var i = 1; i <= level1; i++)
        {
            roots[i - 1] = new CategorySeedNode
            {
                Name = $"Grupa testowa {i}",
                Children = BuildLevel2($"{i}"),
            };
        }

        var total = level1 * (1L + level2 * (1L + level3));
        return new CategorySeedNode
        {
            Name = $"Struktura testowa ({total:N0}+ pozycji)",
            Children = roots,
        };
    }

    /// <summary>
    /// Wstawia kategorie binarnym <c>COPY</c> Npgsql zamiast przez EF.
    ///
    /// Przy profilu <see cref="CategoryTreeProfile.Small"/> to ~180 tys. wierszy, przy
    /// <see cref="CategoryTreeProfile.Stress"/> ponad 9 mln. EF musiałby zbudować tyle samo
    /// obiektów w ChangeTrackerze i wygenerować tyle samo poleceń INSERT — <c>COPY</c> robi to
    /// jednym strumieniem i jest o rzędy wielkości szybszy. Dla pozostałych, małych zbiorów
    /// (produkty, modele, gwarancje) zostaje zwykły EF, bo tam ta złożoność nie zwraca się.
    /// </summary>
    private async Task BulkInsertCategoriesAsync(
        List<(Guid Uuid, string Name, Guid? ParentUuid)> categories,
        CancellationToken cancellationToken)
    {
        var connection = (NpgsqlConnection)_dbContext.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        }

        await using var writer = await connection.BeginBinaryImportAsync(
            $"COPY {CatalogDbContext.SchemaName}.category (uuid, name, parent_uuid) FROM STDIN (FORMAT BINARY)",
            cancellationToken).ConfigureAwait(false);

        foreach (var (uuid, name, parentUuid) in categories)
        {
            await writer.StartRowAsync(cancellationToken).ConfigureAwait(false);
            await writer.WriteAsync(uuid, NpgsqlTypes.NpgsqlDbType.Uuid, cancellationToken).ConfigureAwait(false);
            await writer.WriteAsync(name, NpgsqlTypes.NpgsqlDbType.Varchar, cancellationToken).ConfigureAwait(false);

            if (parentUuid is null)
            {
                await writer.WriteNullAsync(cancellationToken).ConfigureAwait(false);
            }
            else
            {
                await writer.WriteAsync(parentUuid.Value, NpgsqlTypes.NpgsqlDbType.Uuid, cancellationToken)
                    .ConfigureAwait(false);
            }
        }

        await writer.CompleteAsync(cancellationToken).ConfigureAwait(false);
    }

    // ── Pozostałe agregaty ─────────────────────────────────────────────────────

    private List<ProductModel> BuildModels(Random random)
        => [.. Enumerable.Range(1, _options.ModelCount)
            .Select(i => ProductModel.CreateWithUuid(NextUuid(random), $"Model {i}"))];

    private List<Warranty> BuildWarranties(Random random)
        => [.. Enumerable.Range(0, _options.WarrantyCount)
            .Select(i => Warranty.CreateWithUuid(
                NextUuid(random),
                $"Gwarancja {i + 1}",
                ((i % 3) + 1) * 12,
                $"Opis gwarancji {i + 1}"))];

    /// <summary>
    /// Słownik typów kodów. SKU i EAN są unikalne w katalogu, kod producenta świadomie NIE —
    /// to on jest w danych startowych dowodem, że reguła unikalności idzie z wiersza słownika,
    /// a nie z tabeli kodów.
    /// </summary>
    private static List<CodeType> BuildCodeTypes(Random random)
        => [
            CodeType.CreateWithUuid(NextUuid(random), "SKU", "Kod magazynowy", null, isUnique: true, 1),
            CodeType.CreateWithUuid(NextUuid(random), "EAN", "Kod kreskowy EAN-13", @"^\d{13}$", isUnique: true, 2),
            CodeType.CreateWithUuid(NextUuid(random), "MPN", "Kod producenta", null, isUnique: false, 3),
        ];

    /// <summary>
    /// Słownik atrybutów — po jednym z każdego rodzaju, żeby dane startowe pokrywały wszystkie
    /// gałęzie walidacji i wszystkie kolumny wartości.
    /// </summary>
    private static List<AttributeDefinition> BuildAttributes(Random random)
    {
        var color = AttributeDefinition.CreateWithUuid(
            NextUuid(random), "COLOR", "Kolor", AttributeKind.Dictionary, AttributeDataType.None, false, 1);
        color.SetOptions([("BLACK", "Czarny", 1), ("WHITE", "Biały", 2), ("SILVER", "Srebrny", 3)]);

        var weight = AttributeDefinition.CreateWithUuid(
            NextUuid(random), "WEIGHT", "Waga (kg)", AttributeKind.Value, AttributeDataType.Number, false, 2);

        var datasheet = AttributeDefinition.CreateWithUuid(
            NextUuid(random), "DATASHEET", "Karta katalogowa", AttributeKind.Multimedia, AttributeDataType.None,
            isMultiValue: true, 3);

        return [color, weight, datasheet];
    }

    private (List<Product> Products, List<MultimediaAsset> Multimedia) BuildProducts(
        Random random,
        List<Guid> assignableCategoryUuids,
        List<ProductModel> models,
        List<Warranty> warranties,
        List<CodeType> codeTypes,
        List<AttributeDefinition> attributes)
    {
        var products = new List<Product>(_options.ProductCount);
        var multimedia = new List<MultimediaAsset>();
        var now = DateTimeOffset.UtcNow;

        // Dane startowe muszą spełniać inwariant, który system egzekwuje: para
        // (model, komplet kategorii) jest unikalna, pilnowana unikalnym indeksem po
        // `duplicate_key`. Bez tego zbioru losowanie prędzej czy później wygeneruje dwa
        // identycznie sklasyfikowane produkty i cały seed padłby na SaveChanges.
        var claimedDuplicateKeys = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < _options.ProductCount; i++)
        {
            var isActive = random.NextDouble() > 0.2;

            var product = Product.CreateWithUuid(
                NextUuid(random),
                $"Produkt {i + 1}",
                Math.Round((decimal)((random.NextDouble() * 10000) + 10), 2));

            product.SetStatus(isActive ? ProductStatus.Active : ProductStatus.Draft, now);
            product.SetAvailableFrom(now.AddDays(-random.Next(1, 365)));

            // EAN musi mieć dokładnie 13 cyfr — tyle wymaga maska typu kodu w słowniku.
            // Gdyby seed generował coś innego, wywaliłby się na własnej regule, i o to chodzi.
            product.SetCodes([
                ProductCodeAssignment.For(codeTypes[0], $"SKU-{i + 1:D5}"),
                ProductCodeAssignment.For(codeTypes[1], $"590{random.NextInt64(1000000000L, 9999999999L)}"),
                ProductCodeAssignment.For(codeTypes[2], $"MPN-{(i % 300) + 1:D4}"),
            ]);

            var modelUuid = random.NextDouble() > 0.3 && models.Count > 0
                ? models[random.Next(models.Count)].Uuid
                : (Guid?)null;

            var categoryCount = random.Next(1, Math.Min(4, assignableCategoryUuids.Count + 1));
            var categoryUuids = PickRandom(assignableCategoryUuids, categoryCount, random).ToList();

            (modelUuid, categoryUuids) = AvoidDuplicateClassification(
                modelUuid, categoryUuids, assignableCategoryUuids, categoryCount, claimedDuplicateKeys, random);

            product.AssignToModel(modelUuid);
            product.SetCategories(categoryUuids);

            var assetCount = random.Next(0, 5);
            var assetUuids = new List<Guid>(assetCount);
            for (var j = 0; j < assetCount; j++)
            {
                var asset = MultimediaAsset.CreateWithUuid(
                    NextUuid(random),
                    $"File {j + 1} for Produkt {i + 1}.jpg",
                    "image",
                    "https://picsum.photos/200",
                    "https://picsum.photos/800",
                    random.Next(100000, 5000000),
                    "image/jpeg",
                    j,
                    now.AddDays(-random.Next(1, 30)));

                multimedia.Add(asset);
                assetUuids.Add(asset.Uuid);
            }

            product.SetMultimedia(assetUuids);

            // Atrybuty po multimediach, bo karta katalogowa wskazuje na zasób utworzony wyżej.
            var attributeValues = new List<ProductAttributeAssignment>
            {
                ProductAttributeAssignment.Option(
                    attributes[0], PickRandom([.. attributes[0].Options], 1, random)[0].Uuid),
                ProductAttributeAssignment.Number(
                    attributes[1], Math.Round((decimal)(random.NextDouble() * 10), 2)),
            };

            // Atrybut wielowartościowy: kilka kart katalogowych przy jednym produkcie —
            // to on weryfikuje indeks częściowy, który dla jednowartościowych zabrania powtórzeń.
            attributeValues.AddRange(assetUuids
                .Take(random.Next(0, 3))
                .Select((assetUuid, order) =>
                    ProductAttributeAssignment.Multimedia(attributes[2], assetUuid, order)));

            product.SetAttributeValues(attributeValues);

            // Kilka produktów z dziesiątkami gwarancji jest celowe — to one weryfikują
            // zachowanie listy gwarancji w UI przy dużej liczbie pozycji.
            var hasManyWarranties = i < 5 || random.NextDouble() > 0.95;
            var warrantyCount = hasManyWarranties ? random.Next(50, 101) : random.Next(0, 3);
            product.SetWarranties(PickRandom(warranties, warrantyCount, random)
                .Select(w => (
                    w.Uuid,
                    random.NextDouble() > 0.8 ? w.DurationMonths * 2 : w.DurationMonths)));

            products.Add(product);
        }

        return (products, multimedia);
    }

    /// <summary>
    /// Dobiera klasyfikację, która nie koliduje z już wygenerowanymi. Przelosowuje sam zbiór
    /// kategorii (model zostaje — to on daje danym sensowną strukturę wariantów), a po
    /// wyczerpaniu prób odbiera produktowi model: bez modelu produkt nie uczestniczy w regule
    /// duplikatu, więc zawsze istnieje wyjście, które nie zapętla seeda.
    /// </summary>
    private static (Guid? ModelUuid, List<Guid> CategoryUuids) AvoidDuplicateClassification(
        Guid? modelUuid,
        List<Guid> categoryUuids,
        List<Guid> assignableCategoryUuids,
        int categoryCount,
        HashSet<string> claimedDuplicateKeys,
        Random random)
    {
        const int maxAttempts = 10;

        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            var key = Product.ComputeDuplicateKey(modelUuid, categoryUuids);

            // null = produkt bez modelu, poza regułą — nie ma czego rezerwować.
            if (key is null || claimedDuplicateKeys.Add(key))
            {
                return (modelUuid, categoryUuids);
            }

            categoryUuids = [.. PickRandom(assignableCategoryUuids, categoryCount, random)];
        }

        return (null, categoryUuids);
    }

    // ── Pomocnicze ─────────────────────────────────────────────────────────────

    /// <summary>Deterministyczny identyfikator z generatora o stałym ziarnie.
    /// <c>Guid.CreateVersion7()</c> nie nadaje się do seedu — opiera się na czasie i entropii
    /// systemowej, więc każdy przebieg dawałby inne dane.</summary>
    private static Guid NextUuid(Random random)
    {
        var bytes = new byte[16];
        random.NextBytes(bytes);
        return new Guid(bytes);
    }

    private static List<T> PickRandom<T>(IReadOnlyList<T> source, int count, Random random)
    {
        if (count <= 0 || source.Count == 0)
        {
            return [];
        }

        count = Math.Min(count, source.Count);

        // Częściowe tasowanie Fishera-Yatesa na kopii indeksów — w przeciwieństwie do
        // `OrderBy(_ => random.Next())` z poprzedniego mocka nie sortuje całej kolekcji
        // (przy 150 gwarancjach × 1500 produktów to zauważalna różnica).
        var indices = new int[source.Count];
        for (var i = 0; i < indices.Length; i++)
        {
            indices[i] = i;
        }

        var picked = new List<T>(count);
        for (var i = 0; i < count; i++)
        {
            var j = random.Next(i, indices.Length);
            (indices[i], indices[j]) = (indices[j], indices[i]);
            picked.Add(source[indices[i]]);
        }

        return picked;
    }
}
