namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Budzik dla <see cref="BulkCommandRunner{TContext}"/> — podpowiedź „jest coś do zrobienia”,
/// nie kolejka i nie stan współdzielony.
///
/// <para><b>Po co, skoro runner i tak odpytuje bazę co <see cref="BulkJobOptions.IdlePollingInterval"/>.</b>
/// Ten poll zostaje jako <b>sufit</b> — gwarancja, że zadanie podjęte przez inną instancję (albo
/// zlecone zanim ten singleton w ogóle wystartował) i tak zostanie zauważone. Sygnał skraca
/// zwykłą ścieżkę „żądanie HTTP → widoczny skutek” z ~2 s pustego czekania do rzędu milisekund,
/// bez zmiany gwarancji.</para>
///
/// <para><b>Wewnątrzprocesowy, celowo.</b> <see cref="Signal"/> budzi WYŁĄCZNIE runner hostowany
/// w tym samym procesie. Jeśli zadanie podejmie inna instancja (drugi proces tej samej usługi),
/// znajdzie je na swoim zwykłym pollu — dokładnie tak, jak dziś. Nie ma tu więc nic do
/// synchronizowania między instancjami; SemaphoreSlim wystarcza.</para>
///
/// <para><b>Koalescencja.</b> Wiele wywołań <see cref="Signal"/> między dwoma przebudzeniami
/// runnera składa się w jedno budzenie — runner i tak przetwarza WSZYSTKIE dostępne zadania
/// w pętli, więc druga i kolejne pobudki przed pierwszym przebudzeniem nie niosą żadnej nowej
/// informacji.</para>
/// </summary>
public interface IJobQueueSignal
{
    /// <summary>Budzi runner czekający w <see cref="WaitAsync"/>. Bezpieczne wołać z dowolnego
    /// wątku i dowolnie często — nadmiarowe wywołania koalescują się w jedno budzenie.</summary>
    void Signal();

    /// <summary>Czeka na <see cref="Signal"/> albo na upłynięcie <paramref name="timeout"/> —
    /// który zdarzy się pierwszy. Timeout jest tu sufitem opisanym w klasie, nie błędem.</summary>
    Task WaitAsync(TimeSpan timeout, CancellationToken cancellationToken);
}

/// <summary>Implementacja oparta o <see cref="SemaphoreSlim"/> z maksymalnym licznikiem 1 —
/// dokładnie tyle, ile potrzeba do koalescencji opisanej w interfejsie.</summary>
public sealed class JobQueueSignal : IJobQueueSignal, IDisposable
{
    private readonly SemaphoreSlim _semaphore = new(0, 1);

    /// <inheritdoc />
    public void Signal()
    {
        try
        {
            _semaphore.Release();
        }
        catch (SemaphoreFullException)
        {
            // Runner nie zdążył jeszcze skonsumować poprzedniego sygnału — to jest dokładnie
            // koalescencja, o której mówi dokumentacja interfejsu, nie błąd.
        }
    }

    /// <inheritdoc />
    public Task WaitAsync(TimeSpan timeout, CancellationToken cancellationToken)
        => _semaphore.WaitAsync(timeout, cancellationToken);

    public void Dispose() => _semaphore.Dispose();
}
