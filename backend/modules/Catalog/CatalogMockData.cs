using System;
using System.Collections.Generic;
using System.Linq;

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

    static CatalogMockData()
    {
        GenerateData(1500, 20, 15);
    }

    public static void GenerateData(int productCount, int categoryCount, int modelCount)
    {
        var random = new Random();

        Categories = GenerateCategories(categoryCount);
        Models = GenerateModels(modelCount);
        Multimedias.Clear();
        Warranties = GenerateWarranties(150);
        Products = GenerateProducts(productCount, Categories, Models, random);
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

    private static List<CategoryDto> GenerateCategories(int count)
    {
        var list = new List<CategoryDto>();
        for (int i = 0; i < count; i++)
        {
            list.Add(new CategoryDto(Guid.NewGuid(), $"Kategoria {i + 1}", null));
        }
        return list;
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
