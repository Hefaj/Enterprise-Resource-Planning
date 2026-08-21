using System;
using System.Threading;
using System.Threading.Tasks;
using Catalog.Application.Abstractions;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Handler zakładania produktu. Cienki tak samo jak pozostałe: woła fabrykę domenową
/// i oddaje agregat jednostce pracy. Walidacja nazwy i ceny należy do <see cref="Product"/>
/// (fabryka woła te same <c>ValidateName</c>/<c>ValidatePrice</c>, co <c>SetName</c>/<c>SetPrice</c>),
/// więc nie ma jej tutaj.
///
/// <para>Nie implementuje <c>IBulkPreloadingHandler</c> — nie ma czego wczytywać z góry,
/// bo produkt dopiero powstaje.</para>
///
/// <para>Zajętość identyfikatora odsiewa <see cref="ProductUuidAvailableRule"/> PRZED
/// utworzeniem zadania. Tu nie ma powtórki tego sprawdzenia: kosztowałaby zapytanie na
/// element, a ostatnią linią obrony i tak jest klucz główny tabeli.</para>
/// </summary>
public sealed class ProductCreateCommandHandler : CommandHandler<ProductCreateCommand, Guid>
{
    private readonly IProductRepository _repository;

    public ProductCreateCommandHandler(IProductRepository repository)
    {
        _repository = repository;
    }

    public override Task<Guid> ExecuteAsync(ProductCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        // Pusty uuid oznaczałby, że wszystkie pozycje wsadu celują w ten sam (zerowy) klucz
        // główny — pierwsza przeszłaby, a reszta wywróciła cały chunk na kolizji PK.
        // Sprawdzenie PRZED jakąkolwiek zmianą stanu, zgodnie z regułą częściowego sukcesu.
        if (command.Uuid == Guid.Empty)
        {
            throw new DomainException("product_uuid_required", "Identyfikator nowego produktu jest wymagany.");
        }

        var product = Product.CreateWithUuid(command.Uuid, command.Name, command.Price);

        _repository.Add(product);

        return Task.FromResult(product.Uuid);
    }
}
