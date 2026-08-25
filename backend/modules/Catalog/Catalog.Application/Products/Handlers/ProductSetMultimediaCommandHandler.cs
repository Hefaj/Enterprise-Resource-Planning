using Catalog.Application.Abstractions;
using Catalog.Application.Multimedia;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Podmienia komplet multimediów produktu (pusta lista = wyczyszczenie galerii) i domyka
/// kaskadę dla plików <c>Owned</c>, które przy tej podmianie straciły ostatnią referencję.
///
/// <para>Zakres <see cref="ProductLoadScope.Full"/> jest tu warunkiem poprawności podwójnie:
/// bez wczytanej kolekcji podmiana nie usunęłaby z bazy niczego, a kaskada nie zobaczyłaby,
/// co właśnie odpięła.</para>
/// </summary>
public sealed class ProductSetMultimediaCommandHandler
    : CommandHandler<ProductSetMultimediaCommand, Guid>, IBulkPreloadingHandler
{
    private readonly IProductRepository _repository;
    private readonly IMultimediaCascade _cascade;

    public ProductSetMultimediaCommandHandler(IProductRepository repository, IMultimediaCascade cascade)
    {
        _repository = repository;
        _cascade = cascade;
    }

    /// <inheritdoc />
    public Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => _repository.PreloadAsync(aggregateUuids, ProductLoadScope.Full, cancellationToken);

    public override async Task<Guid> ExecuteAsync(ProductSetMultimediaCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Full, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        var detached = product.SetMultimedia(command.MultimediaUuids);

        await _cascade.ApplyAsync(product.Uuid, detached, ct).ConfigureAwait(false);

        return product.Uuid;
    }
}
