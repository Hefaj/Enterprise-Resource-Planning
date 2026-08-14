using System.Text.Json;
using Erp.BuildingBlocks.Jobs;
using FastEndpoints;

namespace Erp.BuildingBlocks.Api.Contracts;

/// <summary>
/// Generyczny egzekutor elementu zadania masowego: odtwarza komendę z JSON-a, podstawia
/// identyfikator agregatu i przekazuje ją handlerowi.
///
/// <para><b>Dlaczego handler jest wstrzykiwany, a nie wołany przez szynę komend FastEndpoints.</b>
/// Rozszerzenie <c>command.ExecuteAsync(ct)</c> rozwiązuje handler z <i>root</i> providera —
/// poza żądaniem HTTP nie ma scope'u, z którego mogłoby skorzystać. Każde wywołanie z zadania
/// w tle kończyło się więc błędem „Cannot resolve scoped service ... from root provider”,
/// dokładnie tak samo jak w poprzedniej implementacji opartej na kolejce w pamięci.
/// Wstrzyknięcie <see cref="ICommandHandler{TCommand,TResult}"/> sprawia, że handler powstaje
/// w scope'ie utworzonym przez runnera, razem z <c>DbContext</c> i repozytoriami tej samej
/// jednostki pracy — bez tego chunk nie mógłby być jedną transakcją.</para>
///
/// <para><b>Nie zapisuje zmian.</b> <c>SaveChanges</c> woła runner raz na chunk — to właśnie
/// czyni chunk jedną transakcją. Handlery komend też nie zapisują: zapis należy do tego,
/// kto wyznacza granicę transakcji.</para>
/// </summary>
/// <typeparam name="TCommand">Typ komendy obsługiwanej przez tego egzekutora.</typeparam>
public sealed class BulkCommandExecutor<TCommand> : IBulkCommandExecutor
    where TCommand : class, IAggregateCommand, ICommand<Guid>, new()
{
    private readonly ICommandHandler<TCommand, Guid> _handler;

    public BulkCommandExecutor(ICommandHandler<TCommand, Guid> handler)
    {
        _handler = handler;
    }

    /// <inheritdoc />
    public string CommandType => typeof(TCommand).Name;

    /// <inheritdoc />
    public async Task ExecuteAsync(Guid aggregateUuid, string? commandJson, CancellationToken cancellationToken)
    {
        var command = string.IsNullOrWhiteSpace(commandJson)
            ? new TCommand()
            : JsonSerializer.Deserialize<TCommand>(commandJson) ?? new TCommand();

        // Uuid z elementu zadania nadpisuje ten z payloadu: w trybie szablonowym payload
        // niesie Guid.Empty, a prawdziwym celem jest to, co wyznaczył filtr lub lista identyfikatorów.
        command.Uuid = aggregateUuid;

        await _handler.ExecuteAsync(command, cancellationToken).ConfigureAwait(false);
    }
}
