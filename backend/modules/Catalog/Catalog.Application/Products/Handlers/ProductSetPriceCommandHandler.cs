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

/// <summary>
/// Handler zmiany ceny.
///
/// <para><see cref="Product.SetPrice"/> dotyka wyłącznie kolumny <c>price</c>, więc handler
/// wczytuje sam korzeń — patrz <see cref="ProductLoadScope"/>.</para>
/// </summary>
public sealed class ProductSetPriceCommandHandler
    : CommandHandler<ProductSetPriceCommand, Guid>, IBulkPreloadingHandler
{
    private readonly IProductRepository _repository;
    private readonly IClock _clock;

    public ProductSetPriceCommandHandler(IProductRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    /// <inheritdoc />
    public Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => _repository.PreloadAsync(aggregateUuids, ProductLoadScope.Root, cancellationToken);

    public override async Task<Guid> ExecuteAsync(ProductSetPriceCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Root, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetPrice(command.Price, _clock.UtcNow);

        return product.Uuid;
    }
}
