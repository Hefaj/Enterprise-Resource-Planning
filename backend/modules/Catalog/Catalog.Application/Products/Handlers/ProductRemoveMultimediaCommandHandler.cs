using Catalog.Application.Abstractions;
using Catalog.Application.Multimedia;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Odpina wskazane zasoby od produktu i domyka kaskadę dla plików <c>Owned</c>.
///
/// <para>Wczytuje agregat w zakresie <see cref="ProductLoadScope.Full"/> z tego samego powodu,
/// co dopinanie: bez wczytanej kolekcji nie byłoby czego odpiąć, a komenda zameldowałaby
/// sukces, nie zmieniając w bazie niczego.</para>
///
/// <para><b>Istnienia odpinanych zasobów nikt nie sprawdza</b> — i słusznie. Przy dopinaniu
/// nieistniejący uuid jest błędem, bo powstałaby referencja donikąd; przy odpinaniu jest
/// żądaniem stanu, który już obowiązuje.</para>
/// </summary>
public sealed class ProductRemoveMultimediaCommandHandler
    : CommandHandler<ProductRemoveMultimediaCommand, Guid>, IBulkPreloadingHandler
{
    private readonly IProductRepository _repository;
    private readonly IMultimediaCascade _cascade;

    public ProductRemoveMultimediaCommandHandler(IProductRepository repository, IMultimediaCascade cascade)
    {
        _repository = repository;
        _cascade = cascade;
    }

    /// <inheritdoc />
    public Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => _repository.PreloadAsync(aggregateUuids, ProductLoadScope.Full, cancellationToken);

    public override async Task<Guid> ExecuteAsync(ProductRemoveMultimediaCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Full, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        var detached = product.RemoveMultimedia(command.MultimediaUuids);

        await _cascade.ApplyAsync(product.Uuid, detached, ct).ConfigureAwait(false);

        return product.Uuid;
    }
}
