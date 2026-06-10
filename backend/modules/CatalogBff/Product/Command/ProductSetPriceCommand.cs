using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CatalogBff.Common;

namespace CatalogBff.Product.Command;

public class ProductSetPriceCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public decimal Price { get; set; }
}

public class ProductSetPriceCommandHandler : CommandHandler<ProductSetPriceCommand, Guid>
{
    public override Task<Guid> ExecuteAsync(ProductSetPriceCommand cmd, CancellationToken ct)
    {
        if (cmd.Price < 0)
        {
            throw new ArgumentException("Cena produktu nie może być ujemna.");
        }

        var index = CatalogMockData.Products.FindIndex(p => p.Uuid == cmd.Uuid);
        if (index == -1)
        {
            throw new KeyNotFoundException($"Nie znaleziono produktu o identyfikatorze: {cmd.Uuid}");
        }

        var jobUuid = Guid.NewGuid();

        // Asynchroniczne delegowanie zadania w tle
        _ = Task.Run(async () =>
        {
            try
            {
                // Symulacja czasu przetwarzania zadania asynchronicznego
                await Task.Delay(3000);

                var idx = CatalogMockData.Products.FindIndex(p => p.Uuid == cmd.Uuid);
                if (idx != -1)
                {
                    var existingProduct = CatalogMockData.Products[idx];
                    CatalogMockData.Products[idx] = existingProduct with { Price = cmd.Price };
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Błąd podczas asynchronicznej zmiany ceny dla zadania {jobUuid}: {ex.Message}");
            }
        });

        return Task.FromResult(jobUuid);
    }
}
