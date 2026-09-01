using Erp.BuildingBlocks.Jobs;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// <see cref="JobQueueSignal"/> nie dotyka bazy — to czysta koalescencja w pamięci procesu,
/// więc test nie potrzebuje <see cref="PostgresCollection"/>.
/// </summary>
public sealed class JobQueueSignalTests
{
    /// <summary>Kryterium z fazy 1 (§8 planu nakładek optymistycznych): zadanie zaakceptowane
    /// budzi czekający runner w rzędzie milisekund, nie po pełnym <c>IdlePollingInterval</c>.</summary>
    [Fact]
    public async Task Signal_budzi_czekajacy_WaitAsync_natychmiast()
    {
        var signal = new JobQueueSignal();
        var cancellationToken = TestContext.Current.CancellationToken;

        var waiting = signal.WaitAsync(TimeSpan.FromSeconds(5), cancellationToken);

        signal.Signal();

        var completed = await Task.WhenAny(waiting, Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken));

        completed.ShouldBe(waiting, "WaitAsync nie obudził się w 500 ms po Signal() — powinien wrócić natychmiast.");
    }

    /// <summary>Bez sygnału <c>WaitAsync</c> wraca dopiero po timeout — to jest sufit opisany
    /// w dokumentacji interfejsu, nadal musi działać, gdy nikt nie zawoła <c>Signal()</c>.</summary>
    [Fact]
    public async Task Brak_sygnalu_konczy_oczekiwanie_dopiero_timeoutem()
    {
        var signal = new JobQueueSignal();
        var cancellationToken = TestContext.Current.CancellationToken;

        var started = DateTimeOffset.UtcNow;
        await signal.WaitAsync(TimeSpan.FromMilliseconds(200), cancellationToken);
        var elapsed = DateTimeOffset.UtcNow - started;

        elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(180));
    }

    /// <summary>Wiele wywołań <c>Signal()</c> przed jednym <c>WaitAsync</c> składają się w JEDNO
    /// budzenie — koalescencja opisana w interfejsie, nie N kolejnych przebudzeń.</summary>
    [Fact]
    public async Task Wielokrotny_Signal_koalescuje_sie_w_jedno_budzenie()
    {
        var signal = new JobQueueSignal();
        var cancellationToken = TestContext.Current.CancellationToken;

        signal.Signal();
        signal.Signal();
        signal.Signal();

        await signal.WaitAsync(TimeSpan.FromMilliseconds(500), cancellationToken);

        var secondWaitStarted = DateTimeOffset.UtcNow;
        await signal.WaitAsync(TimeSpan.FromMilliseconds(200), cancellationToken);
        var elapsed = DateTimeOffset.UtcNow - secondWaitStarted;

        elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(180),
            "Drugie WaitAsync wróciło natychmiast — trzy Signal() nie powinny zostawić drugiego 'w zapasie'.");
    }
}
