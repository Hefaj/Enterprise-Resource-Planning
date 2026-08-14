using System.Text.Json;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;

namespace Erp.BuildingBlocks.Api.Contracts;

/// <summary>
/// Baza endpointów operacji masowych. Przyjmuje żądanie, utrwala zadanie i natychmiast oddaje
/// jego identyfikator — samo wykonanie należy do <see cref="BulkCommandRunner{TContext}"/>.
///
/// <para><b>Co się zmieniło względem poprzedniej wersji.</b> Wcześniej endpoint wrzucał domknięcie
/// do <c>Channel</c> w pamięci procesu i zwracał wygenerowany w locie <c>jobUuid</c>, za którym
/// nie stało nic: restart gubił kolejkę, wyjątki lądowały w <c>Console.WriteLine</c>, a komendy
/// wykonywały się poza scope'em DI (co kończyło się błędem „Cannot resolve scoped service
/// from root provider” — cicho, bo nikt tego wyjątku nie czytał). Frontend rejestrował zadanie,
/// którego backend nie znał, i czekał na zakończenie, które nigdy nie nadchodziło.</para>
///
/// <para>Teraz zadanie jest wierszem w bazie razem ze swoimi elementami, a jego identyfikator
/// to realny klucz, po którym da się odpytać o postęp i wynik.</para>
///
/// <para><b>Kontrakt HTTP pozostaje bez zmian</b> — te same trzy tryby wskazywania celów
/// i ta sama odpowiedź <see cref="BatchResult"/>.</para>
/// </summary>
/// <typeparam name="TCommand">Komenda wykonywana dla pojedynczego agregatu.</typeparam>
/// <typeparam name="TFilter">Filtr wyznaczający zbiór celów.</typeparam>
public abstract class BatchEndpointBase<TCommand, TFilter> : Endpoint<BatchCommand<TCommand, TFilter>, BatchResult>
    where TCommand : IAggregateCommand, ICommand<Guid>
{
    /// <summary>Rozwija filtr na zbiór identyfikatorów agregatów.</summary>
    protected abstract Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(TFilter filter, CancellationToken ct);

    /// <summary>Nazwa typu komendy zapisywana w zadaniu; po niej runner odnajduje egzekutora.</summary>
    protected virtual string CommandType => typeof(TCommand).Name;

    /// <summary>
    /// Pre-check biznesowy uruchamiany PRZED utworzeniem zadania, na całym zbiorze celów naraz —
    /// miejsce na reguły wsadowe (<see cref="IBatchRule{T}"/> / <see cref="ValidationChain{T}"/>)
    /// w rodzaju „czy agregat istnieje”, „czy nie jest duplikatem” itp.
    ///
    /// Domyślnie no-op (pusty tracker), więc endpointy, które go nie potrzebują, nie zauważają
    /// żadnej zmiany. Elementy oznaczone błędem trafiają do zadania od razu jako
    /// <c>Failed</c> (patrz <see cref="Job.Create"/>) — nigdy nie są podejmowane przez
    /// <c>BulkCommandRunner</c>, więc reguła płaci koszt JEDNEGO zbiorczego zapytania zamiast
    /// N osobnych prób wykonania komendy, z których każda i tak by się nie powiodła.
    /// </summary>
    protected virtual Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken ct)
        => Task.FromResult(new ValidationTracker());

    public override async Task HandleAsync(BatchCommand<TCommand, TFilter> req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var (targets, templateJson) = await ResolveTargetsAsync(req, ct).ConfigureAwait(false);

        if (targets.Count == 0)
        {
            ThrowError("Brak komend do wykonania.");
            return;
        }

        var tracker = await ValidateTargetsAsync(
            [.. targets.Select(t => t.AggregateUuid).Distinct()], ct).ConfigureAwait(false);

        var preValidatedFailures = tracker.Errors.Count == 0
            ? null
            : tracker.Errors.ToDictionary(
                kv => kv.Key,
                kv => (kv.Value[0].ErrorCode, kv.Value[0].ErrorMessage));

        var jobStore = Resolve<IJobStore>();

        var jobUuid = await jobStore
            .CreateAsync(CommandType, templateJson, targets, queueId: null, uiMetadata: null, preValidatedFailures, ct)
            .ConfigureAwait(false);

        // Odpowiedź wraca natychmiast, bez czekania na wykonanie — frontend rejestruje
        // zadanie w JobService i śledzi je zdarzeniami, zamiast trzymać otwarte połączenie.
        await Send.OkAsync(new BatchResult { JobUuid = jobUuid }, ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Sprowadza trzy tryby kontraktu do jednej listy celów.
    ///
    /// Kolejność rozstrzygania: jawna lista komend, potem szablon z listą identyfikatorów,
    /// a na końcu szablon z filtrem. Tryby się nie wykluczają — lista komend i szablon mogą
    /// wystąpić razem, więc oba są doklejane do tej samej puli.
    /// </summary>
    private async Task<(List<JobTarget> Targets, string? TemplateJson)> ResolveTargetsAsync(
        BatchCommand<TCommand, TFilter> req,
        CancellationToken ct)
    {
        var targets = new List<JobTarget>();

        // Tryb 1: lista różnych komend — każda niesie własny payload, więc serializujemy
        // je osobno. To dlatego JobItem ma własne pole CommandJson.
        if (req.Commands is { Count: > 0 })
        {
            foreach (var command in req.Commands)
            {
                targets.Add(new JobTarget(command.Uuid, JsonSerializer.Serialize(command)));
            }
        }

        if (req.TemplateCommand is null)
        {
            return (targets, null);
        }

        var templateJson = JsonSerializer.Serialize(req.TemplateCommand);

        // Tryb 2: szablon + jawne identyfikatory.
        if (req.TargetUuids is { Count: > 0 })
        {
            foreach (var uuid in req.TargetUuids)
            {
                targets.Add(new JobTarget(uuid));
            }
        }
        // Tryb 3: szablon + filtr. Zbiór celów wyznacza zapytanie po stronie bazy —
        // klient nie musi (i przy dziesiątkach tysięcy pozycji nie mógłby) wypisać ich w żądaniu.
        else if (req.TargetFilter is not null)
        {
            var filtered = await GetUuidsFromFilterAsync(req.TargetFilter, ct).ConfigureAwait(false);
            foreach (var uuid in filtered)
            {
                targets.Add(new JobTarget(uuid));
            }
        }

        return (targets, templateJson);
    }
}
