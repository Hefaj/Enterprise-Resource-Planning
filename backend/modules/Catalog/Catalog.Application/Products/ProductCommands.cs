using Catalog.Application.Abstractions;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

// Uwaga do warstwy: `ICommand<T>` i `CommandHandler<,>` pochodzą z pakietu FastEndpoints,
// ale są tu użyte WYŁĄCZNIE jako mediator in-process — nie ma w nich nic z HTTP.
// Ta sama komenda jest wykonywana zarówno z endpointu, jak i z BulkCommandRunnera,
// który o HTTP nie wie nic.
//
// ZAPIS: handlery celowo NIE wołają SaveChanges. Granicę transakcji wyznacza wywołujący —
// BulkCommandRunner zatwierdza cały chunk jednym commitem, co jest jedynym sposobem, by
// operacja na 50 tys. produktów nie oznaczała 50 tys. transakcji. Endpoint obsługujący
// pojedynczą komendę musi po dyspozycji sam wywołać IUnitOfWork.SaveChangesAsync().

/// <summary>Zmiana nazwy produktu.</summary>
public sealed class ProductSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

/// <summary>Zmiana ceny produktu.</summary>
public sealed class ProductSetPriceCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    public decimal Price { get; set; }
}

/// <summary>
/// Zmiana klasyfikacji produktu — modelu i kompletu kategorii naraz.
///
/// Obie wartości w jednej komendzie, bo razem tworzą sygnaturę duplikatu: rozdzielone
/// dawałyby stan pośredni (nowy model, stare kategorie), który musiałby przejść przez
/// unikalny indeks, choć nikt takiej klasyfikacji nie chciał.
/// </summary>
public sealed class ProductSetClassificationCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Model, którego wariantem ma być produkt; <c>null</c> czyni go samodzielnym.</summary>
    public Guid? ModelUuid { get; set; }

    /// <summary>Komplet kategorii — podmiana, nie dopisanie.</summary>
    public List<Guid> CategoryUuids { get; set; } = [];
}

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

        var product = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetName(command.Name, _clock.UtcNow);

        return product.Uuid;
    }
}

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
    : CommandHandler<ProductSetClassificationCommand, Guid>
{
    private readonly IProductRepository _repository;
    private readonly IClock _clock;

    public ProductSetClassificationCommandHandler(IProductRepository repository, IClock clock)
    {
        _repository = repository;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(
        ProductSetClassificationCommand command,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetClassification(command.ModelUuid, command.CategoryUuids, _clock.UtcNow);

        return product.Uuid;
    }
}
