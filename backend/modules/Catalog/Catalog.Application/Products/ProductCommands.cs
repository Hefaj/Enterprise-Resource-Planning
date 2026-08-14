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
/// Handler zmiany nazwy. Cienki z założenia: wczytuje agregat, woła metodę domenową, zapisuje.
/// Walidacja nazwy należy do <see cref="Product.SetName"/>, nie tutaj — inaczej ta sama reguła
/// istniałaby w dwóch miejscach i rozeszła się przy pierwszej zmianie.
/// </summary>
public sealed class ProductSetNameCommandHandler : CommandHandler<ProductSetNameCommand, Guid>
{
    private readonly IProductRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public ProductSetNameCommandHandler(
        IProductRepository repository,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ProductSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetName(command.Name, _clock.UtcNow);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return product.Uuid;
    }
}

/// <summary>Handler zmiany ceny.</summary>
public sealed class ProductSetPriceCommandHandler : CommandHandler<ProductSetPriceCommand, Guid>
{
    private readonly IProductRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public ProductSetPriceCommandHandler(
        IProductRepository repository,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(ProductSetPriceCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

        product.SetPrice(command.Price, _clock.UtcNow);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return product.Uuid;
    }
}
