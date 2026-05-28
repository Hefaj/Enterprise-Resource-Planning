using FastEndpoints;
using CatalogBff.Common;

namespace CatalogBff.Product.Command;

public class ProductSetPriceMultipleCommandEndpoint : BatchEndpointBase<ProductSetPriceCommand>
{
    public override void Configure()
    {
        Post("product/batch-set-price");
        Group<ProductGroup>();
        Description(d => d
            .WithSummary("Seryjna aktualizacja cen produktów z obsługą błędów cząstkowych")
            .WithDescription("Umożliwia zmianę ceny wielu produktów jednocześnie. Zwraca status 200 jeśli wszystkie się powiodły, 400 jeśli wszystkie zawiodły, lub 207 Multi-Status dla wyników mieszanych."));
    }
}
