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
/// Handler zmiany nazwy. Cienki z założenia: wczytuje agregat, woła metodę domenową, zapisuje.
/// Walidacja nazwy należy do <see cref="Product.SetName"/>, nie tutaj — inaczej ta sama reguła
/// istniałaby w dwóch miejscach i rozeszła się przy pierwszej zmianie.
/// </summary>
public sealed class ProductSetNameCommandHandler : CommandHandler<ProductSetNameCommand, Guid>
{
    private readonly IProductRepository _repository;
    private readonly IClock _clock;

    public ProductSetNameCommandHandler(IProductRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ProductSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        // await Task.Delay(Random.Shared.Next(1000, 3000), ct);

        var product = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetName(command.Name, _clock.UtcNow);

        return product.Uuid;
    }
}
