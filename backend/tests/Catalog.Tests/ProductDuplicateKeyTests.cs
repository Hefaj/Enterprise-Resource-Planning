using Catalog.Domain.Products;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Sygnatura duplikatu jest kontraktem między trzema miejscami: agregatem (liczy ją przy
/// zapisie), regułą wsadową (pyta o nią bazę) i backfillem migracji. Te testy pilnują
/// definicji „ten sam model i ten sam komplet kategorii”.
/// </summary>
public class ProductDuplicateKeyTests
{
    private static readonly Guid Model = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid CategoryA = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid CategoryB = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000002");

    [Fact]
    public void Kolejnosc_kategorii_nie_zmienia_sygnatury()
    {
        var first = Product.ComputeDuplicateKey(Model, [CategoryA, CategoryB]);
        var second = Product.ComputeDuplicateKey(Model, [CategoryB, CategoryA]);

        second.ShouldBe(first);
    }

    [Fact]
    public void Powtorzone_kategorie_nie_zmieniaja_sygnatury()
    {
        var withoutRepeats = Product.ComputeDuplicateKey(Model, [CategoryA, CategoryB]);
        var withRepeats = Product.ComputeDuplicateKey(Model, [CategoryA, CategoryB, CategoryA]);

        withRepeats.ShouldBe(withoutRepeats);
    }

    [Fact]
    public void Rozny_komplet_kategorii_daje_rozna_sygnature()
    {
        var single = Product.ComputeDuplicateKey(Model, [CategoryA]);
        var both = Product.ComputeDuplicateKey(Model, [CategoryA, CategoryB]);

        both.ShouldNotBe(single);
    }

    [Fact]
    public void Produkt_bez_modelu_nie_uczestniczy_w_regule()
        => Product.ComputeDuplicateKey(null, [CategoryA, CategoryB]).ShouldBeNull();

    /// <summary>
    /// Klucz trafia do bazy, więc musi być stabilny — <c>string.GetHashCode</c> nie jest
    /// (losowane ziarno per proces) i klucz zapisany przed restartem przestałby się zgadzać.
    /// </summary>
    [Fact]
    public void Sygnatura_jest_skrotem_o_stalej_dlugosci()
    {
        var key = Product.ComputeDuplicateKey(Model, [CategoryA, CategoryB]);

        key.ShouldNotBeNull();
        key.Length.ShouldBe(64);
        key.ShouldAllBe(c => char.IsAsciiHexDigitLower(c));
    }

    [Fact]
    public void Agregat_utrzymuje_sygnature_przy_zmianie_klasyfikacji()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);

        product.DuplicateKey.ShouldBeNull();

        product.SetClassification(Model, [CategoryA, CategoryB], DateTimeOffset.UtcNow);

        product.DuplicateKey.ShouldBe(Product.ComputeDuplicateKey(Model, [CategoryA, CategoryB]));
    }

    [Fact]
    public void Odebranie_modelu_kasuje_sygnature()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);
        product.SetClassification(Model, [CategoryA], DateTimeOffset.UtcNow);

        product.SetClassification(null, [CategoryA], DateTimeOffset.UtcNow);

        product.DuplicateKey.ShouldBeNull();
    }

    /// <summary>
    /// Brak zmiany = brak zdarzenia i brak wpisu w ChangeTrackerze, więc nie generuje się
    /// pusty ruch po SignalR. Ta sama zasada co w <c>SetName</c> i <c>SetPrice</c>.
    /// </summary>
    [Fact]
    public void Ta_sama_klasyfikacja_nie_generuje_zdarzenia()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);
        product.SetClassification(Model, [CategoryA, CategoryB], DateTimeOffset.UtcNow);
        product.ClearDomainEvents();

        // Ta sama klasyfikacja, inna kolejność kategorii — to nadal ta sama klasyfikacja.
        product.SetClassification(Model, [CategoryB, CategoryA], DateTimeOffset.UtcNow);

        product.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void Zmiana_klasyfikacji_generuje_zdarzenie_ze_starym_i_nowym_stanem()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);
        product.SetClassification(Model, [CategoryA], DateTimeOffset.UtcNow);
        product.ClearDomainEvents();

        product.SetClassification(Model, [CategoryB], DateTimeOffset.UtcNow);

        var changed = product.DomainEvents.OfType<ProductClassificationChanged>().ShouldHaveSingleItem();
        changed.OldCategoryUuids.ShouldBe([CategoryA]);
        changed.NewCategoryUuids.ShouldBe([CategoryB]);
        product.CategoryUuids.ShouldBe([CategoryB]);
    }
}
