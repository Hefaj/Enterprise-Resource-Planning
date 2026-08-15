using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Sales.Application.Abstractions;
using Sales.Domain.Customers;

namespace Sales.Application.Customers;

/// <summary>Zmiana nazwy klienta — jedyna komenda modułu, wystarczająca do sprawdzenia
/// całej ścieżki: pojedyncze wywołanie i operacja masowa przez tę samą infrastrukturę
/// co w Catalogu (patrz <c>Catalog.Application.Products.ProductSetNameCommand</c>).</summary>
public sealed class SetCustomerNameCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

/// <summary>Handler nie zapisuje zmian — granicę transakcji wyznacza wywołujący
/// (endpoint pojedynczej komendy albo <c>BulkCommandRunner</c> przy operacji masowej).</summary>
public sealed class SetCustomerNameCommandHandler : CommandHandler<SetCustomerNameCommand, Guid>
{
    private readonly ICustomerRepository _repository;

    public SetCustomerNameCommandHandler(ICustomerRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(SetCustomerNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var customer = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Customer), command.Uuid);

        customer.SetName(command.Name);

        return customer.Uuid;
    }
}
