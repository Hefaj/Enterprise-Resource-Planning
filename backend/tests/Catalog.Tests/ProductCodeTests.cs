using Catalog.Domain.Codes;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Domain;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Kody produktu zastąpiły kolumny <c>sku</c> i <c>ean</c>. Te testy pilnują dwóch rzeczy,
/// od których zależy poprawność zapisu: że maska i unikalność biorą się z wiersza słownika
/// (a nie z tabeli kodów), i że podmiana kompletu kodów zostawia nietknięte te, które
/// się nie zmieniły — bo skasowanie i wstawienie tej samej wartości w jednym zapisie
/// stawiałoby wynik w zależności od kolejności poleceń wygenerowanej przez EF.
/// </summary>
public class ProductCodeTests
{
    private static readonly CodeType Ean = CodeType.CreateWithUuid(
        Guid.Parse("cccccccc-0000-0000-0000-000000000001"),
        "EAN", "Kod kreskowy", @"^\d{13}$", isUnique: true, 1);

    private static readonly CodeType Mpn = CodeType.CreateWithUuid(
        Guid.Parse("cccccccc-0000-0000-0000-000000000002"),
        "MPN", "Kod producenta", null, isUnique: false, 2);

    [Fact]
    public void Wartosc_niezgodna_z_maska_typu_jest_odrzucana()
    {
        var exception = Should.Throw<DomainException>(
            () => ProductCodeAssignment.For(Ean, "590123"));

        exception.ErrorCode.ShouldBe("product_code_value_invalid");
    }

    [Fact]
    public void Typ_bez_maski_przyjmuje_dowolna_niepusta_wartosc()
    {
        var assignment = ProductCodeAssignment.For(Mpn, "  ABC-1  ");

        assignment.Value.ShouldBe("ABC-1");
        assignment.Unique.ShouldBeFalse();
    }

    [Fact]
    public void Sygnature_unikalnosci_dostaja_wylacznie_kody_typow_unikalnych()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);

        product.SetCodes([
            ProductCodeAssignment.For(Ean, "5901234567890"),
            ProductCodeAssignment.For(Mpn, "ABC-1"),
        ]);

        var ean = product.Codes.Single(c => c.CodeTypeUuid == Ean.Uuid);
        var mpn = product.Codes.Single(c => c.CodeTypeUuid == Mpn.Uuid);

        ean.UniqueKey.ShouldBe(ProductCode.ComputeUniqueKey(Ean.Uuid, "5901234567890"));
        mpn.UniqueKey.ShouldBeNull();
    }

    [Fact]
    public void Wielkosc_liter_nie_rozroznia_sygnatur_unikalnosci()
    {
        ProductCode.ComputeUniqueKey(Mpn.Uuid, "abc-1")
            .ShouldBe(ProductCode.ComputeUniqueKey(Mpn.Uuid, "ABC-1"));
    }

    [Fact]
    public void Podmiana_kompletu_zostawia_niezmienione_kody_nietkniete()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);
        product.SetCodes([
            ProductCodeAssignment.For(Ean, "5901234567890"),
            ProductCodeAssignment.For(Mpn, "ABC-1"),
        ]);

        var keptBefore = product.Codes.Single(c => c.CodeTypeUuid == Ean.Uuid);

        product.SetCodes([
            ProductCodeAssignment.For(Ean, "5901234567890"),
            ProductCodeAssignment.For(Mpn, "ABC-2"),
        ]);

        // Ten sam OBIEKT, nie tylko ta sama wartość: gdyby powstał nowy, EF wygenerowałby
        // DELETE i INSERT na wierszu objętym unikalnym indeksem.
        product.Codes.Single(c => c.CodeTypeUuid == Ean.Uuid).ShouldBeSameAs(keptBefore);
        product.Codes.Single(c => c.CodeTypeUuid == Mpn.Uuid).Value.ShouldBe("ABC-2");
    }

    [Fact]
    public void Ten_sam_kod_podany_dwa_razy_trafia_raz()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);

        product.SetCodes([
            ProductCodeAssignment.For(Mpn, "ABC-1"),
            ProductCodeAssignment.For(Mpn, "abc-1"),
        ]);

        product.Codes.Count.ShouldBe(1);
    }
}
