using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using CatalogBff.Common.BackgroundJobs;

namespace CatalogBff.Common;

public abstract class BatchEndpointBase<TCommand, TFilter> : Endpoint<BatchCommand<TCommand, TFilter>, BatchResult>
    where TCommand : IAggregateCommand, ICommand<Guid>
{
    protected abstract Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(TFilter filter, CancellationToken ct);

    public override async Task HandleAsync(BatchCommand<TCommand, TFilter> req, CancellationToken ct)
    {
        var jobUuid = Guid.NewGuid();
        var commandsToExecute = new List<TCommand>();

        if (req.Commands != null && req.Commands.Count > 0)
        {
            commandsToExecute.AddRange(req.Commands);
        }

        if (req.TemplateCommand != null)
        {
            var targetUuids = new List<Guid>();
            if (req.TargetUuids != null && req.TargetUuids.Count > 0)
            {
                targetUuids.AddRange(req.TargetUuids);
            }
            else if (req.TargetFilter != null)
            {
                var filteredUuids = await GetUuidsFromFilterAsync(req.TargetFilter, ct);
                targetUuids.AddRange(filteredUuids);
            }

            var jsonTemplate = JsonSerializer.Serialize(req.TemplateCommand);
            foreach (var uuid in targetUuids)
            {
                var clonedCommand = JsonSerializer.Deserialize<TCommand>(jsonTemplate);
                if (clonedCommand != null)
                {
                    clonedCommand.Uuid = uuid;
                    commandsToExecute.Add(clonedCommand);
                }
            }
        }

        if (commandsToExecute.Count == 0)
        {
            ThrowError("Brak komend do wykonania.");
            return;
        }

        // Oddelegowanie wykonania całej paczki komend do wątku w tle za pomocą kolejki Channels
        var taskQueue = Resolve<IBackgroundTaskQueue>();
        await taskQueue.QueueBackgroundWorkItemAsync(async token =>
        {
            foreach (var command in commandsToExecute)
            {
                // Przerwij pętlę, jeśli aplikacja jest wyłączana
                if (token.IsCancellationRequested) break;

                try
                {
                    await command.ExecuteAsync(token);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Błąd przetwarzania komendy w tle dla zadania zbiorczego {jobUuid}: {ex.Message}");
                }
            }
        });

        // Natychmiast zwracamy jobUuid na front, bez oczekiwania na zakończenie zadań
        await Send.OkAsync(new BatchResult { JobUuid = jobUuid }, ct);
    }
}
