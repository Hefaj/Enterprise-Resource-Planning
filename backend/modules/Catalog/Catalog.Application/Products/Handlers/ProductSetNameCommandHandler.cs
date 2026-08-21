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
///
/// <para><see cref="Product.SetName"/> dotyka wyłącznie kolumny <c>name</c>, więc handler
/// wczytuje sam korzeń — jedno zapytanie zamiast sześciu. Zakres jest zadeklarowany dwa razy
/// (w <see cref="PreloadAsync"/> i w <see cref="ExecuteAsync"/>) i to jest celowe: obie
/// deklaracje stoją obok siebie, a gdyby mimo to się rozjechały, repozytorium zejdzie do
/// zwykłego zapytania zamiast oddać agregat wczytany zbyt wąsko.</para>
/// </summary>
public sealed class ProductSetNameCommandHandler
    : CommandHandler<ProductSetNameCommand, Guid>, IBulkPreloadingHandler
{
    private readonly IProductRepository _repository;
    private readonly IClock _clock;

    public ProductSetNameCommandHandler(IProductRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    /// <inheritdoc />
    public Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => _repository.PreloadAsync(aggregateUuids, ProductLoadScope.Root, cancellationToken);

    public override async Task<Guid> ExecuteAsync(ProductSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Root, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetName(command.Name, _clock.UtcNow);

        return product.Uuid;
    }
}
