using System.Text.Json;
using FastEndpoints;

namespace Erp.BuildingBlocks.Api.Contracts;

/// <summary>
/// Cel operacji masowej razem z komendą, która ma się dla niego wykonać.
///
/// Istnieje, bo walidacja wsadowa potrzebuje odpowiedzieć na pytanie „czy po tej komendzie
/// agregat będzie poprawny”, a nie „czy jest poprawny teraz”. Reguły w rodzaju „czy agregat
/// istnieje” wystarczał sam identyfikator; reguła duplikatu potrzebuje WARTOŚCI DOCELOWYCH
/// (jaki model, jakie kategorie zostaną ustawione), bo wynik zależy jednocześnie od payloadu
/// i od stanu bazy per element.
/// </summary>
/// <typeparam name="TCommand">Typ komendy wykonywanej dla pojedynczego agregatu.</typeparam>
/// <param name="AggregateUuid">Agregat, którego dotyczy komenda.</param>
/// <param name="Command">Komenda z podstawionym identyfikatorem agregatu.</param>
public readonly record struct BatchTarget<TCommand>(Guid AggregateUuid, TCommand Command);

/// <summary>
/// Odtwarza komendę pojedynczego elementu zadania masowego z zapisanego JSON-a.
///
/// <para><b>Dlaczego osobny helper, a nie dwie kopie tej samej logiki.</b> Payload czytają dwa
/// miejsca: pre-check w <see cref="BatchEndpointBase{TCommand,TFilter}"/> (przed utworzeniem
/// zadania) i <see cref="BulkCommandExecutor{TCommand}"/> (przy wykonaniu, nawet kilka minut
/// później). Gdyby robiły to własnym kodem, rozjechałyby się przy pierwszej zmianie kontraktu
/// — a to znaczy walidację sprawdzającą coś innego, niż faktycznie się wykona. Cichy,
/// najgorszy rodzaj błędu w operacji na 50 tys. rekordów.</para>
/// </summary>
public static class BatchCommandPayload
{
    /// <summary>
    /// Buduje komendę dla wskazanego agregatu.
    /// </summary>
    /// <param name="itemJson">Payload konkretnego elementu (tryb jawnej listy komend).</param>
    /// <param name="templateJson">Payload szablonu, wspólny dla wszystkich celów.</param>
    /// <param name="aggregateUuid">Cel, dla którego komenda ma się wykonać.</param>
    public static TCommand Materialize<TCommand>(string? itemJson, string? templateJson, Guid aggregateUuid)
        where TCommand : class, IAggregateCommand, ICommand<Guid>, new()
    {
        // Payload elementu ma pierwszeństwo przed szablonem. Tryb `Commands` (lista różnych
        // komend) nie ma szablonu w ogóle, więc sięgnięcie po samo `job.CommandJson` dawałoby
        // pustą komendę z wartościami domyślnymi — czyli operację, która „się udaje”,
        // nie robiąc tego, o co prosił użytkownik.
        var json = itemJson ?? templateJson;

        var command = string.IsNullOrWhiteSpace(json)
            ? new TCommand()
            : JsonSerializer.Deserialize<TCommand>(json) ?? new TCommand();

        // Uuid celu nadpisuje ten z payloadu: w trybie szablonowym payload niesie Guid.Empty,
        // a prawdziwym celem jest to, co wyznaczył filtr lub lista identyfikatorów.
        command.Uuid = aggregateUuid;

        return command;
    }
}
