using Catalog.Application.Products;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Walidator jest miejscem, w którym zapada decyzja „jakie reguły dla której operacji”.
/// Testy pilnują, że reguły są niezależne (element zbiera WSZYSTKIE naruszenia naraz),
/// bo to od tego zależy, czy raport z zadania mówi użytkownikowi całą prawdę.
/// </summary>
public class ProductBatchValidatorTests
{
    private static readonly Guid Model = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Category = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");

    private static ProductBatchValidator Build(
        FakeProductQueries queries,
        FakeMultimediaQueries? multimedia = null)
        => new(
            new ProductMustExistRule(queries),
            new ProductDuplicateRule(queries),
            new ProductMultimediaMustExistRule(multimedia ?? new FakeMultimediaQueries()));

    [Fact]
    public async Task Nieistniejacy_cel_zmiany_nazwy_jest_odrzucany()
    {
        var missing = Guid.NewGuid();
        var validator = Build(new FakeProductQueries());

        var tracker = await validator.ValidateSetNameAsync([missing], CancellationToken.None);

        tracker.Errors[missing][0].ErrorCode.ShouldBe("aggregate_not_found");
    }

    [Fact]
    public async Task Istniejacy_cel_zmiany_ceny_przechodzi()
    {
        var uuid = Guid.NewGuid();
        var validator = Build(new FakeProductQueries { ExistingUuids = { uuid } });

        var tracker = await validator.ValidateSetPriceAsync([uuid], CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>
    /// Reguły są płaskie, nie łańcuchowe — element naruszający obie zbiera oba kody.
    /// Do `job_item.error_code` (jedno pole) trafi pierwszy zarejestrowany.
    /// </summary>
    [Fact]
    public async Task Element_naruszajacy_obie_reguly_zbiera_oba_bledy()
    {
        var uuid = Guid.NewGuid();
        var owner = Guid.NewGuid();

        var queries = new FakeProductQueries
        {
            // Celowo NIE w ExistingUuids — produkt nie istnieje…
            OwnersByDuplicateKey = { [ProductKey()] = owner },
        };

        var tracker = await Build(queries).ValidateSetClassificationAsync(
            [new ProductClassificationTarget(uuid, Model, [Category])],
            CancellationToken.None);

        var codes = tracker.Errors[uuid].Select(e => e.ErrorCode).ToList();
        codes.ShouldBe(["aggregate_not_found", "product_duplicate"]);
    }

    [Fact]
    public async Task Poprawna_zmiana_klasyfikacji_przechodzi()
    {
        var uuid = Guid.NewGuid();
        var validator = Build(new FakeProductQueries { ExistingUuids = { uuid } });

        var tracker = await validator.ValidateSetClassificationAsync(
            [new ProductClassificationTarget(uuid, Model, [Category])],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    private static string ProductKey()
        => Catalog.Domain.Products.Product.ComputeDuplicateKey(Model, [Category])!;

    /// <summary>
    /// Dopięcie multimediów ma DWA warunki niezależne od siebie: cel istnieje i pliki istnieją.
    /// Ten test pilnuje drugiego — bez niego zadanie ruszałoby i wywracało się dopiero
    /// w handlerze, produkt po produkcie.
    /// </summary>
    [Fact]
    public async Task Dopiecie_nieistniejacego_pliku_jest_odrzucane()
    {
        var product = Guid.NewGuid();
        var missingAsset = Guid.NewGuid();

        var validator = Build(
            new FakeProductQueries { ExistingUuids = { product } },
            new FakeMultimediaQueries());

        var tracker = await validator.ValidateAddMultimediaAsync(
            [new ProductMultimediaTarget(product, [missingAsset])],
            CancellationToken.None);

        tracker.Errors[product][0].ErrorCode.ShouldBe("multimedia_not_found");
    }

    [Fact]
    public async Task Dopiecie_istniejacych_plikow_przechodzi()
    {
        var product = Guid.NewGuid();
        var asset = Guid.NewGuid();

        var validator = Build(
            new FakeProductQueries { ExistingUuids = { product } },
            new FakeMultimediaQueries { ExistingUuids = { asset } });

        var tracker = await validator.ValidateAddMultimediaAsync(
            [new ProductMultimediaTarget(product, [asset])],
            CancellationToken.None);

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>
    /// Reguła pyta o istnienie plików RAZ na całe zlecenie, a nie raz na produkt — przy „pięć
    /// zdjęć do tysiąca produktów" to różnica między jednym zapytaniem a tysiącem identycznych.
    /// </summary>
    [Fact]
    public async Task Istnienie_plikow_sprawdzane_jest_jednym_zapytaniem_na_caly_wsad()
    {
        var asset = Guid.NewGuid();
        var products = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToList();

        var multimedia = new FakeMultimediaQueries { ExistingUuids = { asset } };
        var validator = Build(
            new FakeProductQueries { ExistingUuids = [.. products] },
            multimedia);

        await validator.ValidateAddMultimediaAsync(
            [.. products.Select(p => new ProductMultimediaTarget(p, [asset]))],
            CancellationToken.None);

        multimedia.ExistenceQueryCount.ShouldBe(1);
    }

    /// <summary>
    /// Puste zlecenie nie jest sukcesem: zadanie bez ani jednego pliku przemieliłoby wszystkie
    /// cele i nie zmieniło niczego, meldując „gotowe”.
    /// </summary>
    [Fact]
    public async Task Dopiecie_bez_wskazanego_pliku_jest_odrzucane()
    {
        var product = Guid.NewGuid();

        var validator = Build(new FakeProductQueries { ExistingUuids = { product } });

        var tracker = await validator.ValidateAddMultimediaAsync(
            [new ProductMultimediaTarget(product, [])],
            CancellationToken.None);

        tracker.Errors[product][0].ErrorCode.ShouldBe("multimedia_empty");
    }
}
