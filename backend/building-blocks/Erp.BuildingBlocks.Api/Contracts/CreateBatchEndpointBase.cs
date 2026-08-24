using FastEndpoints;

namespace Erp.BuildingBlocks.Api.Contracts;

/// <summary>
/// Baza endpointów wsadowych dla czasownika <c>Create</c> — patrz
/// <c>docs/backend/endpoint-naming.md</c> §4.
///
/// <para><b>Dlaczego osobna baza.</b> Tworzenie jest jedyną operacją, dla której dwa z trzech
/// trybów wskazywania celów nie mają sensu: agregat jeszcze nie istnieje, więc nie ma czego
/// wskazać ani filtrem, ani listą identyfikatorów. Sensowny jest wyłącznie tryb
/// <c>Commands[]</c>, w którym klient przysyła gotowe komendy z wygenerowanymi po swojej
/// stronie uuid-ami.</para>
///
/// <para><b>Co to naprawia.</b> Wcześniej każdy endpoint tworzący implementował
/// <c>GetUuidsFromFilterAsync</c> jako <c>Task.FromResult(Enumerable.Empty&lt;Guid&gt;())</c>
/// z komentarzem wyjaśniającym, że filtr nie ma zastosowania. Żądanie z filtrem przechodziło
/// wtedy przez walidację, zakładało zadanie z zerem celów i wracało do klienta jako sukces
/// z <c>jobUuid</c>, za którym nic nie stało. Tutaj takie żądanie jest odrzucane błędem
/// walidacji, czyli 400 — użytkownik dowiaduje się, że jego intencja jest niewykonalna,
/// zamiast czekać na zadanie, które nigdy nic nie zrobi.</para>
/// </summary>
/// <typeparam name="TCommand">Komenda tworząca pojedynczy agregat.</typeparam>
/// <typeparam name="TFilter">
/// Typ filtra wymagany przez kontrakt <see cref="BatchCommand{TCommand, TFilter}"/>. Zostaje
/// w sygnaturze, żeby kształt żądania był identyczny jak dla pozostałych operacji masowych
/// (jeden typ w kliencie NSwag na wszystkie), ale wartość jest tu zawsze odrzucana.
/// </typeparam>
public abstract class CreateBatchEndpointBase<TCommand, TFilter> : BatchEndpointBase<TCommand, TFilter>
    where TCommand : class, IAggregateCommand, ICommand<Guid>, new()
{
    /// <summary>
    /// Filtr nigdy nie wyznacza celów dla operacji tworzącej — żądanie z filtrem nie dochodzi
    /// do tego miejsca, bo odrzuca je <see cref="HandleAsync"/>. Implementacja jest tu wyłącznie
    /// po to, żeby moduł nie musiał pisać atrapy.
    /// </summary>
    protected sealed override Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        TFilter filter,
        CancellationToken ct)
        => Task.FromResult(Enumerable.Empty<Guid>());

    public override Task HandleAsync(BatchCommand<TCommand, TFilter> req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        if (req.TargetFilter is not null)
        {
            AddError(
                r => r.TargetFilter,
                "Operacja tworząca nie przyjmuje filtra — nowy agregat nie ma jeszcze uuid, "
                + "którym dałoby się go wskazać. Użyj listy `commands`.");
        }

        if (req.TargetUuids is { Count: > 0 })
        {
            AddError(
                r => r.TargetUuids,
                "Operacja tworząca nie przyjmuje listy identyfikatorów — uuid nowego agregatu "
                + "generuje klient i przysyła go wewnątrz komendy. Użyj listy `commands`.");
        }

        if (req.TemplateCommand is not null)
        {
            AddError(
                r => r.TemplateCommand,
                "Operacja tworząca nie przyjmuje szablonu — każdy nowy agregat ma własne uuid "
                + "i własne wartości. Użyj listy `commands`.");
        }

        ThrowIfAnyErrors();

        return base.HandleAsync(req, ct);
    }
}
