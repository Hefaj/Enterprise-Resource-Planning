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
/// Handler zmiany klasyfikacji. Jak pozostałe — cienki; unikalność klasyfikacji NIE jest tu
/// sprawdzana i to jest świadome: pytanie „czy ktoś już ma tę klasyfikację” rozstrzyga się
/// zapytaniem do bazy, które i tak byłoby nieaktualne w chwili commitu. Gwarancję daje
/// unikalny indeks <c>ix_product_duplicate_key</c>, a jego naruszenie tłumaczy
/// <c>IPersistenceExceptionTranslator</c> na kod <c>product_duplicate</c>. Walidacja wsadowa
/// (<see cref="ProductDuplicateRule"/>) jest przed tym wszystkim, żeby użytkownik dostał
/// odpowiedź od razu, a nie po przetworzeniu zadania.
/// </summary>
public sealed class ProductSetClassificationCommandHandler
    : CommandHandler<ProductSetClassificationCommand, Guid>, IBulkPreloadingHandler
{
    private readonly IProductRepository _repository;
    private readonly IClock _clock;

    public ProductSetClassificationCommandHandler(IProductRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    /// <inheritdoc />
    /// <remarks>
    /// Pełny zakres, bez wyjątku: <see cref="Product.SetClassification"/> podmienia KOMPLET
    /// kategorii, więc na niewczytanej kolekcji zobaczyłaby pustkę i dopisała nowe powiązania
    /// obok starych zamiast je zastąpić. To jedyna komenda produktu, dla której zawężenie
    /// wczytania byłoby cichą utratą danych — patrz <see cref="ProductLoadScope.Root"/>.
    /// </remarks>
    public Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken)
        => _repository.PreloadAsync(aggregateUuids, ProductLoadScope.Full, cancellationToken);

    public override async Task<Guid> ExecuteAsync(
        ProductSetClassificationCommand command,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Full, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetClassification(command.ModelUuid, command.CategoryUuids, _clock.UtcNow);

        return product.Uuid;
    }
}
