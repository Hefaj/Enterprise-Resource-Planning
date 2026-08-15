using Catalog.Domain.Attributes;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Domain;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Atrybuty zastąpiły kolumny <c>attr_weight</c> i <c>attr_color</c>. Cena elastyczności jest
/// taka, że o poprawności wartości nie rozstrzyga już typ kolumny — rozstrzyga ją definicja
/// atrybutu. Te testy pilnują, że nie da się jej ominąć: wartość powstaje wyłącznie przez
/// fabrykę, która definicję widzi.
/// </summary>
public class ProductAttributeTests
{
    private static AttributeDefinition Color()
    {
        var color = AttributeDefinition.CreateWithUuid(
            Guid.Parse("dddddddd-0000-0000-0000-000000000001"),
            "COLOR", "Kolor", AttributeKind.Dictionary, AttributeDataType.None, false, 1);
        color.SetOptions([("BLACK", "Czarny", 1), ("WHITE", "Biały", 2)]);
        return color;
    }

    private static AttributeDefinition Weight()
        => AttributeDefinition.CreateWithUuid(
            Guid.Parse("dddddddd-0000-0000-0000-000000000002"),
            "WEIGHT", "Waga", AttributeKind.Value, AttributeDataType.Number, false, 2);

    [Fact]
    public void Atrybut_wartosciowy_wymaga_typu_danych()
    {
        var exception = Should.Throw<DomainException>(() => AttributeDefinition.Create(
            "SIZE", "Rozmiar", AttributeKind.Value, AttributeDataType.None, false, 1));

        exception.ErrorCode.ShouldBe("attribute_data_type_required");
    }

    [Fact]
    public void Atrybut_slownikowy_nie_moze_miec_typu_danych()
    {
        var exception = Should.Throw<DomainException>(() => AttributeDefinition.Create(
            "SIZE", "Rozmiar", AttributeKind.Dictionary, AttributeDataType.Text, false, 1));

        exception.ErrorCode.ShouldBe("attribute_data_type_not_applicable");
    }

    [Fact]
    public void Wartosc_w_zlym_typie_danych_jest_odrzucana()
    {
        var exception = Should.Throw<DomainException>(
            () => ProductAttributeAssignment.Text(Weight(), "ciężki"));

        exception.ErrorCode.ShouldBe("attribute_data_type_mismatch");
    }

    [Fact]
    public void Wartosc_podana_jak_dla_innego_rodzaju_jest_odrzucana()
    {
        var exception = Should.Throw<DomainException>(
            () => ProductAttributeAssignment.Number(Color(), 5m));

        exception.ErrorCode.ShouldBe("attribute_kind_mismatch");
    }

    [Fact]
    public void Opcja_z_innego_atrybutu_jest_odrzucana()
    {
        var exception = Should.Throw<DomainException>(
            () => ProductAttributeAssignment.Option(Color(), Guid.NewGuid()));

        exception.ErrorCode.ShouldBe("attribute_option_unknown");
    }

    /// <summary>
    /// Na identyfikator opcji wskazuje każdy produkt, który ją wybrał — podmiana listy
    /// dopuszczalnych wartości nie może go zmienić, bo zerwałaby wszystkie te przypisania
    /// bez jednego błędu przy zapisie (między agregatami nie ma klucza obcego).
    /// </summary>
    [Fact]
    public void Podmiana_opcji_zachowuje_identyfikatory_pozostalych()
    {
        var color = Color();
        var blackBefore = color.FindOption("BLACK")!.Uuid;

        color.SetOptions([("BLACK", "Czarny mat", 1), ("SILVER", "Srebrny", 3)]);

        color.FindOption("BLACK")!.Uuid.ShouldBe(blackBefore);
        color.FindOption("BLACK")!.Name.ShouldBe("Czarny mat");
        color.FindOption("WHITE").ShouldBeNull();
        color.FindOption("SILVER").ShouldNotBeNull();
    }

    [Fact]
    public void Wartosci_atrybutow_trafiaja_do_produktu_z_kopia_rodzaju()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);
        var color = Color();

        product.SetAttributeValues([
            ProductAttributeAssignment.Option(color, color.FindOption("BLACK")!.Uuid),
            ProductAttributeAssignment.Number(Weight(), 3.5m),
        ]);

        var dictionary = product.AttributeValues.Single(v => v.Kind == AttributeKind.Dictionary);
        var value = product.AttributeValues.Single(v => v.Kind == AttributeKind.Value);

        dictionary.OptionUuid.ShouldBe(color.FindOption("BLACK")!.Uuid);
        dictionary.ValueNumber.ShouldBeNull();
        value.ValueNumber.ShouldBe(3.5m);
        value.OptionUuid.ShouldBeNull();
    }

    [Fact]
    public void Podmiana_wartosci_zostawia_niezmienione_nietkniete()
    {
        var product = Product.CreateWithUuid(Guid.NewGuid(), "Produkt", 10m);
        var color = Color();
        var weight = Weight();

        product.SetAttributeValues([
            ProductAttributeAssignment.Option(color, color.FindOption("BLACK")!.Uuid),
            ProductAttributeAssignment.Number(weight, 3.5m),
        ]);

        var keptBefore = product.AttributeValues.Single(v => v.AttributeUuid == color.Uuid);

        product.SetAttributeValues([
            ProductAttributeAssignment.Option(color, color.FindOption("BLACK")!.Uuid),
            ProductAttributeAssignment.Number(weight, 4m),
        ]);

        product.AttributeValues.Single(v => v.AttributeUuid == color.Uuid).ShouldBeSameAs(keptBefore);
        product.AttributeValues.Single(v => v.AttributeUuid == weight.Uuid).ValueNumber.ShouldBe(4m);
    }
}
