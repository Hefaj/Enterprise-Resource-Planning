namespace Notification.Infrastructure.Realtime;

/// <summary>
/// Monotoniczny licznik zdarzeń realtime dla jednej sygnatury agregatu — trwały, w bazie.
///
/// <para><b>Dlaczego w bazie, a nie w pamięci procesu (jak było) ani w Redisie.</b> Dotychczasowe
/// uzasadnienie dla licznika ulotnego brzmiało: restart zeruje licznik, ale zrywa też
/// <b>wszystkie</b> połączenia SignalR, więc każdy klient wraca przez <c>Subscribe</c>
/// z zapamiętanym <c>lastSeenSequence</c>, widzi na serwerze zero, wykrywa rozjazd jako lukę
/// i wymusza resync. Rozumowanie było poprawne dokładnie dlatego, że licznik i połączenia
/// <b>ginęły razem</b>.</para>
///
/// <para>Po rozdzieleniu ról Hub/Relay przestaje to być prawdą: restart przekaźnika nie zrywa
/// połączeń, bo te wiszą na hubach. Licznik wystartowałby od zera, klient trzymałby
/// <c>lastSeenSequence = 850</c>, a kolejne zdarzenia dostawałyby numery 1, 2, 3 — <b>numery,
/// które ten klient już widział</b>. Przy ponownej subskrypcji rozjazd dałby resync (fałszywie
/// dodatni, znośne), ale <b>bez</b> ponownej subskrypcji luka nie zostałaby zauważona w ogóle —
/// czyli dokładnie ten przypadek, przed którym mechanizm miał chronić.</para>
///
/// <para>Wniosek: licznik musi przeżyć proces, który go zwiększa. Tabela w schemacie modułu daje
/// to bez nowej infrastruktury i bez pytania o konfigurację trwałości Redisa — który zostaje
/// wyłącznie backplanem SignalR (patrz <c>docs/backend/multi-instance.md</c> §1).</para>
///
/// <para><b>Zwykła klasa, nie encja domenowa.</b> To licznik infrastruktury realtime, a nie byt
/// biznesowy — nie ma niezmiennika do pilnowania, nie ma zdarzeń, nie ma tożsamości innej niż
/// sama sygnatura. Dziedziczenie po <c>Entity</c> dołożyłoby mu <c>Uuid</c>, którego nikt nigdy
/// by nie użył, i równość po tym <c>Uuid</c>, która byłaby nieprawdziwa.</para>
///
/// <para><b>Koszt jest pomijalny.</b> Zapis leci raz na okno koalescencji (najwyżej ~5/s na
/// sygnaturę), a odczyt tylko przy <c>Subscribe</c>.</para>
/// </summary>
public sealed class SignatureSequence
{
    /// <summary>Sygnatura agregatu (<c>catalog.product</c>, <c>jobs</c>…) — klucz naturalny.</summary>
    public string Signature { get; private set; } = string.Empty;

    /// <summary>Bieżąca wartość licznika.</summary>
    public long Value { get; private set; }
}
