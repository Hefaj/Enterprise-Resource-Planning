using System;
using System.Collections.Generic;

namespace CatalogBff;

public record CategoryDto(
    Guid Uuid,
    string Name,
    Guid? ParentUuid
);

public record ModelDto(
    Guid Uuid,
    string Name
);

public record ProductDto(
    Guid Uuid,
    string Name,
    List<Guid> CategoryUuids,
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

public static class CatalogMockData
{
    public static readonly Guid CatElectronics = Guid.Parse("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");
    public static readonly Guid CatLaptops = Guid.Parse("b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e");
    public static readonly Guid CatSmartphones = Guid.Parse("c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f");
    public static readonly Guid CatHome = Guid.Parse("d4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f90");

    public static readonly Guid ModelMbp = Guid.Parse("e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f901a");
    public static readonly Guid ModelIphone = Guid.Parse("f67a8b9c-0d1e-2f3a-4b5c-6d7e8f901a2b");

    public static readonly List<CategoryDto> Categories = new()
    {
        new(CatElectronics, "Elektronika", null),
        new(CatLaptops, "Laptopy", CatElectronics),
        new(CatSmartphones, "Smartfony", CatElectronics),
        new(CatHome, "Dom i Ogród", null)
    };

    public static readonly List<ModelDto> Models = new()
    {
        new(ModelMbp, "M3 Max 16 inch"),
        new(ModelIphone, "iPhone 15 Pro")
    };

    public static readonly List<ProductDto> Products = GenerateMockProducts();

    private static List<ProductDto> GenerateMockProducts()
    {
        var list = new List<ProductDto>
        {
            new(
                Guid.Parse("11111111-1111-1111-1111-111111111111"),
                "Laptop ProMax 16\"",
                new List<Guid> { CatElectronics, CatLaptops },
                ModelMbp,
                "ELE-001",
                5499.99m,
                new DateTime(2024, 3, 15),
                "Aktywny",
                true,
                "5901234567890",
                null
            ),
            new(
                Guid.Parse("22222222-2222-2222-2222-222222222222"),
                "Monitor UltraWide 34\"",
                new List<Guid> { CatElectronics },
                null,
                "ELE-002",
                2899.00m,
                new DateTime(2024, 1, 20),
                "Aktywny",
                true,
                "5901234567891",
                null
            ),
            new(
                Guid.Parse("33333333-3333-3333-3333-333333333333"),
                "Fotel Ergonomiczny ErgoPlus",
                new List<Guid> { CatHome },
                null,
                "DOM-001",
                1299.00m,
                new DateTime(2024, 6, 1),
                "Wycofany",
                false,
                "5901234567892",
                null
            ),
            new(
                Guid.Parse("44444444-4444-4444-4444-444444444444"),
                "Klawiatura Mechaniczna RGB",
                new List<Guid> { CatElectronics },
                null,
                "ELE-003",
                449.99m,
                new DateTime(2024, 2, 10),
                "Aktywny",
                true,
                "5901234567893",
                null
            ),
            new(
                Guid.Parse("55555555-5555-5555-5555-555555555555"),
                "Biurko Standing Desk 180cm",
                new List<Guid> { CatHome },
                null,
                "DOM-002",
                2199.00m,
                new DateTime(2024, 4, 22),
                "Aktywny",
                true,
                "5901234567894",
                null
            )
        };

        for (int i = 6; i <= 150; i++)
        {
            var isElec = i % 2 == 0;
            var categoryUuids = isElec
                ? new List<Guid> { CatElectronics, CatLaptops }
                : new List<Guid> { CatHome };

            var sku = isElec ? $"ELE-{i:D3}" : $"DOM-{i:D3}";
            var name = isElec ? $"Urządzenie elektroniczne v{i}" : $"Akcesorium domowe v{i}";
            var price = 99.99m + (i * 15.5m);
            var date = new DateTime(2024, 1, 1).AddDays(i);
            var active = i % 3 != 0;
            var status = active ? "Aktywny" : "Draft";
            var ean = $"5901234567{i:D3}";

            list.Add(new ProductDto(
                Guid.NewGuid(),
                name,
                categoryUuids,
                isElec && i % 4 == 0 ? ModelMbp : null,
                sku,
                price,
                date,
                status,
                active,
                ean,
                null,
                $"{(1.0 + i * 0.05):F1}kg",
                i % 2 == 0 ? "Space Gray" : "Black"
            ));
        }

        return list;
    }
}
