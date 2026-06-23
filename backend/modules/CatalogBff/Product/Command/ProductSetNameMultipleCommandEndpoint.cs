using FastEndpoints;
using CatalogBff.Common;

namespace CatalogBff.Product.Command;

public class ProductSetNameMultipleCommandEndpoint : BatchEndpointBase<ProductSetNameCommand>
{
    public override void Configure()
    {
        Post("product/batch-set-name");
        Group<ProductGroup>();
        Description(d => d
            .WithSummary("Seryjna aktualizacja nazw produktów z obsługą błędów cząstkowych")
            .WithDescription("Umożliwia zmianę nazwy wielu produktów jednocześnie. Zwraca status 200 jeśli wszystkie się powiodły, 400 jeśli wszystkie zawiodły, lub 207 Multi-Status dla wyników mieszanych."));
    }
}
