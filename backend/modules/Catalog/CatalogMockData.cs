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
    public static List<CategoryDto> Categories { get; private set; } = new();
    public static List<ModelDto> Models { get; private set; } = new();
    public static List<ProductDto> Products { get; private set; } = new();

    static CatalogMockData()
    {
        GenerateData(150, 10, 5);
    }

    public static void GenerateData(int productCount, int categoryCount, int modelCount)
    {
        var random = new Random();

        Categories = GenerateCategories(categoryCount);
        Models = GenerateModels(modelCount);
        Products = GenerateProducts(productCount, Categories, Models, random);
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
            
            list.Add(new ProductDto(
                Guid.NewGuid(),
                $"Produkt {i + 1}",
                productCategories,
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
