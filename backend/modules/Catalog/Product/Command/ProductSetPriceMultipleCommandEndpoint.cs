using FastEndpoints;
using Catalog.Common;
using Catalog.Product.Query;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Catalog.Product.Command;

public class ProductSetPriceMultipleCommandEndpoint : BatchEndpointBase<ProductSetPriceCommand, SearchProductRequest>
{
    public override void Configure()
    {
        Post("product/batch-set-price");
        Group<ProductGroup>();
        Description(d => d
            .WithSummary("Seryjna aktualizacja cen produktów z obsługą błędów cząstkowych")
            .WithDescription("Umożliwia zmianę ceny wielu produktów jednocześnie na podstawie filtrów, identyfikatorów lub konkretnych komend."));
    }

    protected override Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchProductRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Products.AsEnumerable().ApplyFilter(req);
        return Task.FromResult(query.Select(p => p.Uuid));
    }
}
