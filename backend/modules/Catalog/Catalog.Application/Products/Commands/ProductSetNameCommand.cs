using System;
using Catalog.Application.Abstractions;
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
