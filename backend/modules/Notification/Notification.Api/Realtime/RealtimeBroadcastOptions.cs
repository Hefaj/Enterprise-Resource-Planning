namespace Notification.Api.Realtime;

/// <summary>Strojenie przekaźnika zdarzeń → SignalR; sekcja <c>Realtime</c> w appsettings.</summary>
public sealed class RealtimeBroadcastOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Realtime";

    /// <summary>
    /// Powyżej ilu identyfikatorów w jednym oknie koalescencji zamiast
    /// <c>ReceiveUpdates(signature, uuids)</c> leci <c>ReceiveInvalidation(signature, "all")</c>.
    ///
    /// Bulk na 50 tys. produktów nie może wysłać 50 tys. uuid-ów przez WebSocket do każdej
    /// otwartej przeglądarki — to świadoma wymiana precyzji na przepustowość.
    /// </summary>
    public int InvalidationThreshold { get; set; } = 1000;

    /// <summary>
    /// Okno, w którym zdarzenia dla tej samej sygnatury są zbierane przed wysłaniem jednej
    /// wiadomości. Operacja masowa zatwierdzająca chunk co kilkadziesiąt milisekund
    /// wygenerowałaby bez tego okna równie gęstą serię wiadomości do klienta.
    /// </summary>
    public TimeSpan CoalesceWindow { get; set; } = TimeSpan.FromMilliseconds(200);
}
