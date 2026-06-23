using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CatalogBff.Common;

namespace CatalogBff.Product.Command;

public class ProductSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class ProductSetNameCommandHandler : CommandHandler<ProductSetNameCommand, Guid>
{
    public override Task<Guid> ExecuteAsync(ProductSetNameCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.Name))
        {
            throw new ArgumentException("Nazwa produktu nie może być pusta.");
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
                    CatalogMockData.Products[idx] = existingProduct with { Name = cmd.Name };
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Błąd podczas asynchronicznej zmiany nazwy dla zadania {jobUuid}: {ex.Message}");
            }
        });

        return Task.FromResult(jobUuid);
    }
}
