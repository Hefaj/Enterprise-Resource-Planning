namespace Notification.Api.Realtime;

/// <summary>
/// Rola instancji Notification w realtime.
///
/// <para>Sednem podziału jest to, że przekaźnik robi dwie rzeczy o <b>sprzecznych wymaganiach</b>:
/// <i>decyduje</i>, co wysłać (koalescencja, próg, sekwencja — wymaga JEDNEGO miejsca, żeby próg
/// w ogóle miał sens) i <i>wysyła</i> (wymaga WIELU miejsc, bo tam siedzą WebSockety). Rozdzielenie
/// ról zamyka przy okazji problem <i>competing consumers</i>: skoro huby nie słuchają kolejki,
/// nie ma czego dzielić między instancje, a bufor koalescencji i próg działają dokładnie tak jak
/// przy jednej instancji — bo faktycznie <b>są</b> jednoinstancyjne. To zachowanie semantyki,
/// a nie odtwarzanie jej w rozproszeniu; rozproszone okno koalescencji (kto jest właścicielem
/// timera? kto scala bufory?) jest zadaniem znacznie trudniejszym, niż na to wygląda.</para>
/// </summary>
public enum RealtimeRole
{
    /// <summary>
    /// Jedno i drugie w jednym procesie — <b>dzisiejsze zachowanie i wartość domyślna</b>.
    /// Poprawne przy dokładnie jednej instancji Notification, czyli w devie i w każdym wdrożeniu,
    /// które nie skaluje realtime poziomo.
    /// </summary>
    Both = 0,

    /// <summary>
    /// Wystawia <c>/hubs/sync</c>, obsługuje <c>Subscribe</c>/<c>Unsubscribe</c> i <b>nie konsumuje
    /// z brokera</b>. Instancji może być N.
    /// </summary>
    Hub = 1,

    /// <summary>
    /// Konsumuje <c>AggregateChanged</c>, koalescuje, liczy sekwencję, rozstrzyga próg i wysyła
    /// gotową decyzję przez <c>IHubContext</c> → backplane. <b>Dokładnie jedna instancja.</b>
    ///
    /// <para>Koszt przyjmowany świadomie: przekaźnik staje się pojedynczym punktem awarii realtime
    /// <i>i</i> repliki zadań (handlery <c>Job*</c> też siedzą na tej kolejce). Danych to nie gubi —
    /// kolejka jest trwała, komunikaty czekają, a po restarcie przekaźnik nadrabia. Awaria degraduje
    /// UI do „odśwież ręcznie" i wstrzymuje historię zadań, czyli do tej samej klasy skutku, którą
    /// realtime ma już dziś zapisaną jako „wygoda, nie gwarancja".</para>
    /// </summary>
    Relay = 2,
}

/// <summary>Strojenie przekaźnika zdarzeń → SignalR; sekcja <c>Realtime</c> w appsettings.</summary>
public sealed class RealtimeBroadcastOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Realtime";

    /// <summary>Rola tej instancji — patrz <see cref="RealtimeRole"/>.</summary>
    public RealtimeRole Role { get; set; } = RealtimeRole.Both;

    /// <summary>
    /// Adres Redisa dla backplane'u SignalR (np. <c>redis:6379</c>); puste — bez backplane'u.
    ///
    /// <para><b>Jedyne miejsce w systemie, gdzie Redis jest potrzebny.</b> SignalR nie ma
    /// backplane'u na Postgresie, a wysyłka do grupy musi dosięgnąć połączeń wiszących na innych
    /// hubach. Wszystko inne — dzierżawy, licznik sekwencji, koordynacja startu — idzie przez
    /// Postgresa, który już jest transakcyjnym źródłem prawdy (patrz
    /// <c>docs/architecture/multi-instance.md</c> §1). Nie dokładaj tu cache'a uprawnień ani kolejek:
    /// awaria Redisa ma degradować realtime, a nie kłaść autoryzację całego ERP.</para>
    ///
    /// <para>Puste przy <see cref="RealtimeRole.Both"/> jest poprawne i normalne — jedna instancja
    /// nie ma z kim się synchronizować.</para>
    /// </summary>
    public string? Redis { get; set; }

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
