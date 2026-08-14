using Erp.BuildingBlocks.Contracts;

namespace Notification.Api.Realtime;

/// <summary>
/// Punkt wejścia z brokera do świata SignalR. Sam nie rozgłasza nic — przekazuje zdarzenie
/// do <see cref="RealtimeBroadcaster"/>, który je koalescuje w oknie czasowym per sygnatura
/// (patrz uzasadnienie tam). Rozdzielenie na te dwie klasy jest celowe: handler Wolverine'a
/// jest tworzony per komunikat (nowa instancja za każdym razem), więc bufor koalescencji
/// musi żyć w osobnym, długowiecznym singletonie.
/// </summary>
public static class AggregateChangedRelayHandler
{
    public static void Handle(AggregateChanged message, RealtimeBroadcaster broadcaster) => broadcaster.Enqueue(message);
}
