using Catalog.Application.Abstractions;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Dopina wskazane zasoby do produktu.
///
/// <para>Wczytuje agregat w zakresie <see cref="ProductLoadScope.Full"/>, bo
/// <see cref="Product.AddMultimedia"/> dotyka kolekcji: na wczytanym samym korzeniu sprawdzenie
/// powtórzeń zobaczyłoby pustkę i dopisało drugi wiersz na tę samą parę, a ten wywróciłby się
/// dopiero na unikalnym indeksie w bazie.</para>
///
/// <para><b>Istnienia zasobów handler nie sprawdza</b> — robi to raz na całą operację
/// <c>ProductMultimediaMustExistRule</c> w walidacji wsadowej. Sprawdzanie w handlerze
/// oznaczałoby to samo zapytanie powtórzone dla każdego produktu z osobna.</para>
/// </summary>
public sealed class ProductAddMultimediaCommandHandler
    : CommandHandler<ProductAddMultimediaCommand, Guid>, IBulkPreloadingHandler
{
    private readonly IProductRepository _repository;

    public ProductAddMultimediaCommandHandler(IProductRepository repository) => _repository = repository;

    /// <inheritdoc />
    public Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => _repository.PreloadAsync(aggregateUuids, ProductLoadScope.Full, cancellationToken);

    public override async Task<Guid> ExecuteAsync(ProductAddMultimediaCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Full, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.AddMultimedia(command.MultimediaUuids);

        return product.Uuid;
    }
}
