---
id: architecture.realtime
title: Synchronizacja w czasie rzeczywistym (SignalR)
summary: Centralny SignalR, sygnatury agregatów, grupy, koalescencja i resynchronizacja.
kind: architecture
scope: notification
audience:
  - backend
  - agent
triggers:
  - SignalR i nowa sygnatura agregatu
  - realtime resync lub koalescencja
related: []
---

# Synchronizacja w czasie rzeczywistym (SignalR)

Opisany kontrakt obowiązuje także przy wielu instancjach Notification (rozdział ról
`Realtime:Role` + backplane Redis — sekcja 6).

---

## 1. Jeden hub, jedno miejsce

Hub żyje **wyłącznie** w Notification —
[`SyncHub`](../../backend/modules/Notification/Notification.Api/Hubs/SyncHub.cs),
ścieżka `/hubs/sync`. Pozostałe serwisy (Catalog, Sales, Identity) nie wiedzą, że SignalR istnieje —
publikują tylko `AggregateChanged` do RabbitMQ ([`events-outbox.md`](integration-events.md)).
Notification konsumuje i rozgłasza.

```
Catalog/Sales ──AggregateChanged──▶ RabbitMQ ──▶ AggregateChangedRelayHandler ──▶ RealtimeBroadcaster ──▶ SyncHub ──▶ przeglądarka
```

[`AggregateChangedRelayHandler`](../../backend/modules/Notification/Notification.Api/Realtime/AggregateChangedRelayHandler.cs)
sam nie rozgłasza nic — to statyczna metoda `Handle`, konwencja Wolverine'a tworzy ją per komunikat
(nowa instancja za każdym razem). Przekazuje zdarzenie do `RealtimeBroadcaster`, który **musi**
być długowiecznym singletonem, bo trzyma bufor koalescencji między wywołaniami.

Frontend nie wymaga żadnej zmiany URL-a: `SIGNALR_HUB_URL` wskazywał na `/hubs/sync` od pierwszego
stubu `SignalrSyncService`.

---

## 2. Grupy

| Grupa | Kto dołącza | Do czego |
|---|---|---|
| `agg:{signature}` | jawnie, wywołaniem `Subscribe(signature, ...)` | `ReceiveUpdates`/`ReceiveDeletes`/`ReceiveInvalidation`/`ReceiveSequence`/`ReceiveResync` dla tej sygnatury |
| `user:{userId}` | automatycznie w `OnConnectedAsync`, z claimu `sub` tokenu | kanał `jobs` — powiadomienia trafiają wyłącznie do zleceniodawcy |
| `client:{clientId}` | jw., ale z query stringu połączenia | zarezerwowane, dziś bez konsumenta |

**`Subscribe` jest jawne, nie automatyczne przy połączeniu.** Klient dołącza do `agg:{signature}`
dopiero, gdy faktycznie ma w cache agregaty tej sygnatury — bez tego każda otwarta karta
przeglądarki dostawałaby ruch całego ERP, niezależnie od tego, co akurat wyświetla.

> **Tożsamość pochodzi z tokenu, nie z query stringu.** Hub ma `[Authorize]`, a klient łączy się
> przez `accessTokenFactory` — token jedzie w query stringu `access_token`, bo SignalR nie pozwala
> na własne nagłówki przy negocjacji WebSocketu (obsługa w `ErpAuthExtensions.OnMessageReceived`).
> Grupa `user:{userId}` bierze się z `Context.UserIdentifier`, którego wartość ustawia
> [`SubjectUserIdProvider`](../../backend/modules/Notification/Notification.Api/Hubs/SubjectUserIdProvider.cs)
> z claimu `sub` — domyślny provider ASP.NET Core czyta `ClaimTypes.NameIdentifier`, a
> `MapInboundClaims = false` celowo wyłącza mapowanie nazw claimów, więc bez tego providera
> `UserIdentifier` byłoby zawsze `null` i grupa nigdy by się nie wypełniła.
>
> `clientId` zostaje w query stringu — to nie jest tożsamość, tylko identyfikator karty
> przeglądarki (patrz `ExecutionContextMiddleware`), więc nie ma czego weryfikować.

---

## 3. Koalescencja i próg inwalidacji

[`RealtimeBroadcaster`](../../backend/modules/Notification/Notification.Api/Realtime/RealtimeBroadcaster.cs)
zbiera przychodzące `AggregateChanged` w buforze per sygnatura i wysyła **jedną** wiadomość po
oknie `RealtimeBroadcastOptions.CoalesceWindow` (domyślnie 200 ms). Bez tego bulk zatwierdzający
chunk co kilkadziesiąt milisekund ([`bulk-commands.md`](../guides/backend/bulk-commands.md)) wysyłałby równie gęstą
serię wiadomości do każdej otwartej przeglądarki.

Debounce jest „od pierwszego zdarzenia w oknie”, nie „od ostatniego” — inaczej ciągły strumień
zmian mógłby nigdy nie doczekać się zrzutu.

Powyżej `InvalidationThreshold` (domyślnie 1000) zebranych identyfikatorów w jednym oknie, zamiast
`ReceiveUpdates(signature, uuids)` leci `ReceiveInvalidation(signature, "all")` — świadoma wymiana
precyzji na przepustowość. Bulk na 50 tys. produktów nie może wysłać 50 tys. uuid-ów przez
WebSocket do każdej karty przeglądarki.

Strojenie w `appsettings`, sekcja `Realtime`:

```json
"Realtime": { "InvalidationThreshold": 1000, "CoalesceWindow": "00:00:00.200" }
```

### Cztery metody serwer → klient

| Metoda | Kiedy | Odbiorca |
|---|---|---|
| `ReceiveUpdates(signature, uuids)` | upsert, poniżej progu | `agg:{signature}` |
| `ReceiveDeletes(signature, uuids)` | usunięcie, poniżej progu | `agg:{signature}` |
| `ReceiveInvalidation(signature, "all")` | powyżej progu w oknie koalescencji | `agg:{signature}` |
| `ReceiveSequence(signature, sequence)` | po każdym flushu i po każdym `Subscribe` | `agg:{signature}` / `Clients.Caller` |

Rozszerzenia dokładane są jako **osobne metody**, nigdy jako nowy parametr istniejącej —
`ReceiveUpdates(signature, uuids)` to pierwszy kontrakt, na którym oparł się jeszcze stub
`SignalrSyncService`, i zostaje nietknięty.

---

## 4. Kanał `jobs` a `notification.job`

Dwa różne sygnały, celowo rozdzielone:

| | `notification.job` | `jobs` |
|---|---|---|
| Konwencja nazwy | `{moduł}.{agregat}` | łamie konwencję celowo |
| Niesie | uuid agregatów `Job` | trackingID zakończonych zadań |
| Kto słucha | `BaseOrchestrator` (odświeża przez `getJob`) | `JobService` (`onUpdate('jobs')`) |
| Skąd leci | automatycznie, `AggregateChangeScanner` na zapisie repliki | jawnie, `JobCompletedHandler` |
| Adresat | grupa `agg:notification.job` | grupa `user:{userId}` |

Oba sygnały biorą się **z tego samego zapisu** w `JobCompletedHandler`
([`bulk-commands.md`](../guides/backend/bulk-commands.md#5-replika-w-notification)), ale mają różnych odbiorców
i różne przeznaczenie: jeden mówi „ta encja Job się zmieniła, odśwież ją, jeśli masz w cache”,
drugi — „Twoje zadanie X się skończyło, oznacz jako przeczytane bez pytania API”.

---

## 5. Resync po luce

Problem: `withAutomaticReconnect` po stronie klienta ukrywa krótkie zerwania połączenia, ale nowe
połączenie dostaje **nowy `ConnectionId`** — SignalR nie pamięta grup między połączeniami. Zdarzenia
opublikowane w oknie rozłączenia są bezpowrotnie stracone dla tego klienta, który zostaje z cichym,
nieaktualnym cache.

### Mechanizm

[`SignatureSequence`](../../backend/modules/Notification/Notification.Infrastructure/Realtime/SignatureSequence.cs)
— monotoniczny licznik **w bazie** (`notification.signature_sequence`), per sygnatura, zwiększany
raz na flush atomowym `INSERT … ON CONFLICT DO UPDATE … RETURNING` (upsert i delete tej samej
koalescencji dzielą jeden numer — to jeden „moment” z punktu widzenia klienta).

Trwałość nie jest tu ostrożnością. Dopóki licznik i połączenia **ginęły razem** (jeden proces),
ulotny licznik był poprawny: restart zerował go, ale zrywał też wszystkie połączenia, więc każdy
klient wracał przez `Subscribe`, widział zero i wykrywał lukę. Po rozdzieleniu ról restart
przekaźnika **nie zrywa** połączeń — te wiszą na hubach — więc wyzerowany licznik zacząłby wydawać
numery `1, 2, 3`, które klient z `lastSeenSequence = 850` już widział, a bez ponownej subskrypcji
luka nie zostałaby zauważona w ogóle.

Klient zapamiętuje ostatni widziany numer (`ReceiveSequence`) i przekazuje go jako drugi,
opcjonalny argument przy każdym `Subscribe` — zarówno pierwszym, jak i po `onreconnected`:

```csharp
public async Task Subscribe(string signature, long? lastSeenSequence = null)
{
    // ...dołączenie do grupy...
    var current = _sequenceTracker.Current(signature);
    if (lastSeenSequence.HasValue && lastSeenSequence.Value != current)
    {
        await Clients.Caller.SendAsync("ReceiveResync", signature);
    }
    await Clients.Caller.SendAsync("ReceiveSequence", signature, current);
}
```

Rozjazd `lastSeenSequence` z aktualnym stanem → `ReceiveResync(signature)`. Frontend reaguje
identycznie jak na `ReceiveInvalidation(.., "all")`: `IdentityMapStore.clear()` +
`DataLoader.reloadAsync()` dla tego, co orkiestrator ma aktualnie załadowane
(`base-orchestrator.ts`, `onResync`/`_handleFullResync`).

### Świadome uproszczenie — bez bufora historii

Nie ma tu odtwarzania luki (replay konkretnych zdarzeń) — **każda wykryta luka kończy się pełnym
resync**, nie próbą częściowego dogonienia. Zbudowanie bufora historii zdarzeń to osobny, znacznie
większy projekt (event log per sygnatura, retencja, porządkowanie). Degenerowany przypadek „luki
nie da się odtworzyć” jest tu **zawsze prawdziwy**, bo nie ma z czego odtwarzać
— zgodne w duchu z progiem inwalidacji `all` (świadoma utrata precyzji na rzecz prostoty).

### Dlaczego restart Notification nie psuje wykrywania

Licznik przeżywa proces, bo leży w tabeli `notification.signature_sequence`. Restart przekaźnika
nie cofa więc numeracji, a restart hubu zrywa połączenia, po czym klient i tak wraca przez
`onreconnected` → `Subscribe` z zapamiętanym `lastSeenSequence`. W obu przypadkach porównanie
odbywa się z tą samą, monotoniczną wartością — mechanizm nie ma jak po cichu skłamać.

Wariant ulotny (licznik w pamięci procesu) był poprawny dopóty, dopóki licznik i połączenia
**ginęły razem**; rozdział ról Hub/Relay to rozerwał. Uzasadnienie rewizji:
[`multi-instance.md` — role Hub i Relay](multi-instance.md#realtime-role-hub-i-relay).

### Wiele instancji Notification

Licznik jest wspólny dla całej floty, bo zwiększa go atomowy `INSERT … ON CONFLICT DO UPDATE …
RETURNING`, a zwiększa go **jeden** przekaźnik (`Realtime:Role = Relay`). Huby tylko czytają
wartość przy `Subscribe`, więc dołożenie kolejnego hubu nie rozszczepia numeracji — patrz
sekcja 6.

---

## 6. Skalowanie — backplane

Notification jako centralny hub to pojedynczy punkt awarii realtime, ale **nie zapisów** — te idą
przez outbox ([`events-outbox.md`](integration-events.md)) i doczekają brokera. Awaria hubu degraduje
UI do „odśwież ręcznie”, nie gubi danych.

Skalowanie poziome Notification jest wdrożone i steruje nim **jedno** ustawienie — `Realtime:Role`:

| Rola | Co robi | Ile instancji |
|---|---|---|
| `Both` | Jedno i drugie — **wartość domyślna**, dev i każde wdrożenie bez skalowania realtime | 1 |
| `Relay` | Konsumuje `AggregateChanged`, koalescuje, liczy sekwencję, rozstrzyga próg, wysyła przez `IHubContext` → backplane | **dokładnie 1** |
| `Hub` | Wystawia `/hubs/sync`, obsługuje `Subscribe`/`Unsubscribe`, **nie konsumuje z brokera** | N |

**Sam backplane by nie wystarczył** i to jest sedno tego podziału. Bufor koalescencji
i `InvalidationThreshold` (sekcja 3) żyją w pamięci instancji, a instancje Notification są
*competing consumers* na jednej kolejce — każda widziałaby ułamek strumienia i próg przestałby
trafiać dokładnie przy operacji masowej, dla której powstał. Rozdział ról zamyka to inaczej niż
przez współdzielenie stanu: skoro huby nie słuchają kolejki, decyzję podejmuje jeden przekaźnik
i próg znów widzi cały strumień.

Dwie rzeczy idą z tym w parze:

- **Licznik sekwencji jest trwały** (`notification.signature_sequence`), a nie w pamięci — po
  rozdzieleniu ról restart przekaźnika **nie zrywa** połączeń, więc wyzerowany licznik zaczynałby
  wydawać numery, które klienci już widzieli. Szerzej: [`multi-instance.md`](multi-instance.md#realtime-role-hub-i-relay).
- **Front łączy się z `skipNegotiation: true`**, więc load balancer nie potrzebuje powinowactwa
  sesji. Cena: znika fallback na SSE i long-polling.

Redis wchodzi wyłącznie jako backplane (`Realtime:Redis`) i wyłącznie tutaj — patrz
[`architecture.md` §7](backend.md#7-wieloinstancyjność--założenia-zdjęte).

---

## 7. Frontend — gdzie żyje konsument

- [`signalr-sync.service.ts`](../../frontend/libs/shared/data-access/src/lib/sync/signalr-sync.service.ts)
  — połączenie, ref-counted `subscribe`/`unsubscribe` per sygnatura (bo `BaseOrchestrator` nie jest
  root-singletonem — kolejne nawigacje tworzą i niszczą kolejne instancje), `_lastSeenSequence`.
- [`base-orchestrator.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/base-orchestrator.ts)
  — subskrybuje `onUpdate`/`onDelete`/`onResync` dla swojej sygnatury w konstruktorze, wypina się
  (`unsubscribe`) w `ngOnDestroy`.
- [`job.service.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/job.service.ts)
  — root-singleton, jawny `subscribe('jobs')` raz na całą sesję, nigdy nie wypina się (poprawnie).

`onUpdate`/`onDelete`/`onResync` same w sobie **nie mają efektu ubocznego** — są czystymi filtrami
nad współdzielonymi `Subject`ami. Subskrypcja grupy na hubie wymaga jawnego `subscribe(signature)`;
bez niego wiadomości i tak nigdy by nie nadeszły.

---

## 8. Zobacz też

- [Zdarzenia domenowe i outbox](integration-events.md) — skąd bierze się `AggregateChanged`
- [Operacje masowe](../guides/backend/bulk-commands.md) — kanał `jobs`, replika `notification.job`
- [Architektura backendu](backend.md)
