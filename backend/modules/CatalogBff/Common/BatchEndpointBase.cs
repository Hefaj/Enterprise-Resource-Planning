using FastEndpoints;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace CatalogBff.Common;

public abstract class BatchEndpointBase<TCommand> : Endpoint<BatchCommand<TCommand>, BatchResult>
    where TCommand : IAggregateCommand, ICommand<Guid>
{
    public override async Task HandleAsync(BatchCommand<TCommand> req, CancellationToken ct)
    {
        var jobUuid = Guid.NewGuid();

        // Oddelegowanie wykonania całej paczki komend do wątku w tle (nie blokując wątku HTTP)
        _ = Task.Run(async () =>
        {
            if (req.Commands != null)
            {
                foreach (var command in req.Commands)
                {
                    try
                    {
                        // Wykonanie pojedynczej komendy w tle
                        // Komenda ta wewnętrznie również deleguje swoje szczegółowe zadanie
                        await command.ExecuteAsync(CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Błąd przetwarzania komendy w tle dla zadania zbiorczego {jobUuid}: {ex.Message}");
                    }
                }
            }
        });

        // Natychmiast zwracamy jobUuid na front, bez oczekiwania na zakończenie zadań
        await Send.OkAsync(new BatchResult { JobUuid = jobUuid }, ct);
    }
}
