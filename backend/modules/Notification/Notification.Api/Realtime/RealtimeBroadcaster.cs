using System.Collections.Concurrent;
using Erp.BuildingBlocks.Contracts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Notification.Api.Hubs;
using Notification.Infrastructure.Persistence;

namespace Notification.Api.Realtime;

/// <summary>
/// Koalescuje przychodzące <see cref="AggregateChanged"/> w krótkim oknie czasowym per sygnatura
/// i rozgłasza je hubem SignalR — jeden mechanizm obsługujący oba problemy naraz:
///
/// <list type="bullet">
///   <item><b>Gęstość zdarzeń.</b> Bulk zatwierdzający chunk co kilkadziesiąt milisekund
///     wysyłałby bez koalescencji równie gęstą serię wiadomości do każdej przeglądarki.
///     Zamiast tego zdarzenia dla tej samej sygnatury zbierają się przez
///     <see cref="RealtimeBroadcastOptions.CoalesceWindow"/> i wychodzą jako jedna wiadomość.</item>
///   <item><b>Fan-out.</b> Powyżej <see cref="RealtimeBroadcastOptions.InvalidationThreshold"/>
///     zebranych identyfikatorów w oknie zamiast wysyłać wszystkie leci
///     <c>ReceiveInvalidation(signature, "all")</c> — świadoma utrata precyzji przy masowych
///     zmianach na rzecz przepustowości.</item>
/// </list>
///
/// <para>Sygnatura <see cref="AggregateSignatures.Jobs"/> jest kierowana inaczej niż pozostałe:
/// nie do grupy <c>agg:jobs</c> (taka nie istnieje — klient nigdy jej nie subskrybuje), tylko
/// do grup <c>user:{userId}</c> właścicieli poszczególnych zadań, ustalanych przez odpytanie
/// repliki. Stąd też ten kanał nie podlega progowi inwalidacji — liczba zadań jednego
/// użytkownika w oknie 200 ms nie bywa duża, a odbiorca i tak jest ograniczony do jednej osoby.</para>
///
/// <para>Rejestrowany jako singleton: stan koalescencji (bufor per sygnatura) musi przetrwać
/// między wywołaniami wielu równoległych handlerów Wolverine'a, które same są tworzone
/// per komunikat w osobnych scope'ach.</para>
/// </summary>
public sealed partial class RealtimeBroadcaster : IDisposable
{
    private readonly ConcurrentDictionary<string, PendingBatch> _pending = new(StringComparer.Ordinal);
    private readonly IHubContext<SyncHub> _hub;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RealtimeBroadcastOptions _options;
    private readonly SignatureSequenceTracker _sequenceTracker;
    private readonly ILogger<RealtimeBroadcaster> _logger;

    public RealtimeBroadcaster(
        IHubContext<SyncHub> hub,
        IServiceScopeFactory scopeFactory,
        IOptions<RealtimeBroadcastOptions> options,
        SignatureSequenceTracker sequenceTracker,
        ILogger<RealtimeBroadcaster> logger)
    {
        _hub = hub;
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _sequenceTracker = sequenceTracker;
        _logger = logger;
    }

    /// <summary>Dokłada zdarzenie do bufora sygnatury i planuje (albo pozostawia zaplanowany)
    /// zrzut po upływie okna koalescencji.</summary>
    public void Enqueue(AggregateChanged change)
    {
        ArgumentNullException.ThrowIfNull(change);

        var batch = _pending.GetOrAdd(change.Signature, _ => new PendingBatch());

        lock (batch)
        {
            var target = change.Change == ChangeType.Deleted ? batch.Deleted : batch.Upserted;
            foreach (var uuid in change.Uuids)
            {
                target.Add(uuid);
            }

            // Timer już zaplanowany dla tej sygnatury — kolejne zdarzenia dokładają się
            // do tego samego okna, nie przesuwają go (debounce „od pierwszego”, nie „od ostatniego”
            // zdarzenia — inaczej ciągły strumień zmian mógłby nigdy nie doczekać się zrzutu).
            batch.Timer ??= new Timer(FlushCallback, change.Signature, _options.CoalesceWindow, Timeout.InfiniteTimeSpan);
        }
    }

    private void FlushCallback(object? state)
    {
        var signature = (string)state!;

        if (!_pending.TryRemove(signature, out var batch))
        {
            return;
        }

        HashSet<Guid> upserted;
        HashSet<Guid> deleted;

        lock (batch)
        {
            batch.Timer?.Dispose();
            upserted = batch.Upserted;
            deleted = batch.Deleted;
        }

        // Fire-and-forget świadomie: Timer nie ma async callbacku, a błąd pojedynczego zrzutu
        // (np. padnięcie huba) nie może zwalić callera ani pozostałych, niepowiązanych okien.
        _ = FlushAsync(signature, upserted, deleted);
    }

    private async Task FlushAsync(string signature, HashSet<Guid> upserted, HashSet<Guid> deleted)
    {
        try
        {
            if (string.Equals(signature, AggregateSignatures.Jobs, StringComparison.Ordinal))
            {
                await BroadcastJobsAsync(upserted).ConfigureAwait(false);
                return;
            }

            await BroadcastAggregateAsync(signature, upserted, ChangeType.Upserted).ConfigureAwait(false);
            await BroadcastAggregateAsync(signature, deleted, ChangeType.Deleted).ConfigureAwait(false);

            // Upsert i delete tej samej koalescencji dzielą jeden numer sekwencji — to jeden
            // "moment" z punktu widzenia klienta, niezależnie od tego, ile odrębnych wiadomości
            // faktycznie wysłano. Osobna metoda (nie parametr ReceiveUpdates/ReceiveDeletes),
            // żeby nie zmieniać istniejących sygnatur wołanych już przez SignalrSyncService.
            var sequence = _sequenceTracker.Next(signature);
            await _hub.Clients.Group(GroupNames.ForAggregate(signature))
                .SendAsync("ReceiveSequence", signature, sequence)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Odświeżenie w czasie rzeczywistym jest wygodą, nie gwarancją — klient bez niego
            // pozostaje z nieaktualnym cache do czasu ręcznego odświeżenia, ale nic się nie psuje
            // trwale. Awaria rozgłoszenia nie może więc przewrócić hosta ani zgubić innych okien.
            LogFlushFailed(_logger, signature, ex);
        }
    }

    private async Task BroadcastAggregateAsync(string signature, HashSet<Guid> uuids, ChangeType changeType)
    {
        if (uuids.Count == 0)
        {
            return;
        }

        var group = _hub.Clients.Group(GroupNames.ForAggregate(signature));

        if (uuids.Count > _options.InvalidationThreshold)
        {
            LogInvalidating(_logger, signature, uuids.Count);
            await group.SendAsync("ReceiveInvalidation", signature, AggregateInvalidated.ScopeAll)
                .ConfigureAwait(false);
            return;
        }

        var payload = uuids.Select(u => u.ToString()).ToArray();
        var method = changeType == ChangeType.Deleted ? "ReceiveDeletes" : "ReceiveUpdates";
        await group.SendAsync(method, signature, payload).ConfigureAwait(false);
    }

    /// <summary>
    /// Rozgłasza kanał <c>jobs</c> — trackingID trafiają wyłącznie do zleceniodawcy zadania.
    /// Wymaga jednego zapytania do repliki, żeby ustalić, kto jest adresatem każdego zadania;
    /// koalescencja czyni to zapytanie zbiorczym zamiast jednego na zdarzenie.
    ///
    /// <para>Adresowanie idzie DWOMA kanałami: grupą <c>user:{userId}</c> i grupą
    /// <c>client:{clientId}</c>. Nie jest to nadmiarowość — dopóki backend nie ma
    /// uwierzytelniania, <c>UserId</c> bywa pusty (żądanie bez nagłówka <c>X-User-Id</c>,
    /// patrz <c>ExecutionContextMiddleware</c>) i wtedy jedynym znanym adresatem jest karta
    /// przeglądarki, która zadanie zleciła. Gdy oba są znane, zadanie trafi do obu grup;
    /// SignalR sam odsiewa duplikat, bo to jedno i to samo połączenie.</para>
    /// </summary>
    private async Task BroadcastJobsAsync(HashSet<Guid> jobUuids)
    {
        if (jobUuids.Count == 0)
        {
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NotificationDbContext>();

        var owners = await db.NotificationJobs
            .AsNoTracking()
            .Where(j => jobUuids.Contains(j.Uuid) && (j.UserId != null || j.ClientId != null))
            .Select(j => new { j.Uuid, j.UserId, j.ClientId })
            .ToListAsync()
            .ConfigureAwait(false);

        foreach (var group in owners.Where(o => o.UserId != null).GroupBy(o => o.UserId))
        {
            var trackingIds = group.Select(o => o.Uuid.ToString()).ToArray();
            await _hub.Clients.Group(GroupNames.ForUser(group.Key!))
                .SendAsync("ReceiveUpdates", AggregateSignatures.Jobs, trackingIds)
                .ConfigureAwait(false);
        }

        foreach (var group in owners.Where(o => o.ClientId != null).GroupBy(o => o.ClientId))
        {
            var trackingIds = group.Select(o => o.Uuid.ToString()).ToArray();
            await _hub.Clients.Group(GroupNames.ForClient(group.Key!))
                .SendAsync("ReceiveUpdates", AggregateSignatures.Jobs, trackingIds)
                .ConfigureAwait(false);
        }
    }

    public void Dispose()
    {
        foreach (var batch in _pending.Values)
        {
            batch.Timer?.Dispose();
        }
    }

    private sealed class PendingBatch
    {
        public HashSet<Guid> Upserted { get; } = [];

        public HashSet<Guid> Deleted { get; } = [];

        public Timer? Timer { get; set; }
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning,
        Message = "Rozgłoszenie zmian dla sygnatury {Signature} nie powiodło się.")]
    private static partial void LogFlushFailed(ILogger logger, string signature, Exception exception);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information,
        Message = "Próg inwalidacji przekroczony dla {Signature} ({Count} identyfikatorów) — wysyłam ReceiveInvalidation.")]
    private static partial void LogInvalidating(ILogger logger, string signature, int count);
}
