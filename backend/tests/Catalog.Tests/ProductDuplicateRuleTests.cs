using Catalog.Application.Products;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Validation;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Reguła duplikatu jest pre-checkiem, więc jej zadaniem jest odsiać oczywiste odrzucenia
/// JEDNYM zapytaniem, zanim powstanie zadanie masowe. Gwarancją pozostaje unikalny indeks.
/// </summary>
public class ProductDuplicateRuleTests
{
    private static readonly Guid ModelA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ModelB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid CategoryA = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid CategoryB = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000002");

    private static string KeyFor(Guid? model, params Guid[] categories)
        => Product.ComputeDuplicateKey(model, categories)!;

    private static async Task<ValidationTracker> RunAsync(
        FakeProductQueries queries,
        params ProductClassificationTarget[] targets)
    {
        var tracker = new ValidationTracker();
        await new ProductDuplicateRule(queries)
            .ExecuteAsync(targets, t => t.Uuid, tracker, CancellationToken.None);
        return tracker;
    }

    [Fact]
    public async Task Kolizja_z_istniejacym_produktem_jest_odrzucana()
    {
        var owner = Guid.NewGuid();
        var candidate = Guid.NewGuid();

        var queries = new FakeProductQueries
        {
            OwnersByDuplicateKey = { [KeyFor(ModelA, CategoryA)] = owner },
        };

        var tracker = await RunAsync(queries, new ProductClassificationTarget(candidate, ModelA, [CategoryA]));

        tracker.HasError(candidate).ShouldBeTrue();
        tracker.Errors[candidate][0].ErrorCode.ShouldBe("product_duplicate");
    }

    /// <summary>
    /// Produkt, który już zajmuje daną sygnaturę, może dostać ją ponownie — komenda nadająca
    /// tę samą klasyfikację jest no-opem, a nie naruszeniem reguły.
    /// </summary>
    [Fact]
    public async Task Produkt_nie_koliduje_sam_ze_soba()
    {
        var uuid = Guid.NewGuid();

        var queries = new FakeProductQueries
        {
            OwnersByDuplicateKey = { [KeyFor(ModelA, CategoryA)] = uuid },
        };

        var tracker = await RunAsync(queries, new ProductClassificationTarget(uuid, ModelA, [CategoryA]));

        tracker.HasError(uuid).ShouldBeFalse();
    }

    /// <summary>
    /// Sedno reguły: bez tego wsad nadający tę samą klasyfikację wielu produktom przeszedłby
    /// pre-check w całości (żaden nie koliduje z bazą) i rozbił się dopiero o unikalny indeks —
    /// element po elemencie, w trybie izolacji BulkCommandRunnera.
    /// </summary>
    [Fact]
    public async Task Kolizja_wewnatrz_wsadu_przepuszcza_pierwszy_element()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var third = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeProductQueries(),
            new ProductClassificationTarget(first, ModelA, [CategoryA]),
            new ProductClassificationTarget(second, ModelA, [CategoryA]),
            new ProductClassificationTarget(third, ModelA, [CategoryA]));

        tracker.HasError(first).ShouldBeFalse();
        tracker.HasError(second).ShouldBeTrue();
        tracker.HasError(third).ShouldBeTrue();
    }

    [Fact]
    public async Task Rozne_klasyfikacje_w_jednym_wsadzie_przechodza()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeProductQueries(),
            new ProductClassificationTarget(first, ModelA, [CategoryA]),
            new ProductClassificationTarget(second, ModelB, [CategoryA]));

        tracker.Errors.ShouldBeEmpty();
    }

    [Fact]
    public async Task Produkty_bez_modelu_nigdy_ze_soba_nie_koliduja()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeProductQueries(),
            new ProductClassificationTarget(first, null, [CategoryA]),
            new ProductClassificationTarget(second, null, [CategoryA]));

        tracker.Errors.ShouldBeEmpty();
    }

    [Fact]
    public async Task Kolejnosc_kategorii_nie_ukrywa_kolizji()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var tracker = await RunAsync(
            new FakeProductQueries(),
            new ProductClassificationTarget(first, ModelA, [CategoryA, CategoryB]),
            new ProductClassificationTarget(second, ModelA, [CategoryB, CategoryA]));

        tracker.HasError(second).ShouldBeTrue();
    }

    /// <summary>Cały sens mechanizmu wsadowego: jedno zapytanie, nie N.</summary>
    [Fact]
    public async Task Caly_wsad_kosztuje_jedno_zapytanie()
    {
        var queries = new FakeProductQueries();

        var targets = Enumerable.Range(0, 50)
            .Select(i => new ProductClassificationTarget(Guid.NewGuid(), ModelA, [Guid.NewGuid()]))
            .ToArray();

        await RunAsync(queries, targets);

        queries.DuplicateKeyQueryCount.ShouldBe(1);
    }

    [Fact]
    public async Task Wsad_bez_modeli_nie_odpytuje_bazy()
    {
        var queries = new FakeProductQueries();

        await RunAsync(queries, new ProductClassificationTarget(Guid.NewGuid(), null, [CategoryA]));

        queries.DuplicateKeyQueryCount.ShouldBe(0);
    }
}
