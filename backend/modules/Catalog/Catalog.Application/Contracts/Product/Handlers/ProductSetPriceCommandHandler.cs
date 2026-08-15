using System;
using System.Threading;
using System.Threading.Tasks;
using Catalog.Application.Abstractions;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>Handler zmiany ceny.</summary>
public sealed class ProductSetPriceCommandHandler : CommandHandler<ProductSetPriceCommand, Guid>
{
    private readonly IProductRepository _repository;
    private readonly IClock _clock;

    public ProductSetPriceCommandHandler(IProductRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ProductSetPriceCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetPrice(command.Price, _clock.UtcNow);

        return product.Uuid;
    }
}
