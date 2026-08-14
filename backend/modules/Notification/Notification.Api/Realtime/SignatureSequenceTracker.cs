using System.Collections.Concurrent;

namespace Notification.Api.Realtime;

/// <summary>
/// Monotoniczny licznik zdarzeń per sygnatura — podstawa mechanizmu resync
/// (<c>SyncHub.Subscribe</c>, <see cref="RealtimeBroadcaster"/>).
///
/// Celowo tylko w pamięci procesu, tak jak bufor koalescencji w <see cref="RealtimeBroadcaster"/>.
/// Restart Notification zeruje liczniki, ale to nie psuje wykrywania luk: wszystkie połączenia
/// SignalR i tak padają przy restarcie, więc każdy klient wraca z jakimś zapamiętanym
/// <c>lastSeenSequence</c> sprzed restartu, a serwer widzi 0 — rozjazd zostaje poprawnie
/// wykryty jako luka i wymusza pełny resync, zamiast po cichu kłamać nieaktualnym stanem.
///
/// Ograniczenie: przy więcej niż jednej instancji Notification (wymaga wtedy backplane'u,
/// patrz `RealtimeBroadcastOptions`) każda instancja liczy osobno — do rozwiązania razem
/// z włączeniem backplane'u, nie wcześniej.
/// </summary>
public sealed class SignatureSequenceTracker
{
    private readonly ConcurrentDictionary<string, long> _sequences = new(StringComparer.Ordinal);

    /// <summary>Zwiększa licznik danej sygnatury i zwraca nową wartość.</summary>
    public long Next(string signature) => _sequences.AddOrUpdate(signature, 1, static (_, current) => current + 1);

    /// <summary>Aktualna wartość licznika danej sygnatury; 0, jeśli jeszcze nic nie nadeszło.</summary>
    public long Current(string signature) => _sequences.GetValueOrDefault(signature, 0);
}
