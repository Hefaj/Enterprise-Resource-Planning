# Synchronizacja w czasie rzeczywistym (SignalR)

**Stan: ✅ działa**, przy jednej instancji Notification. Legenda znaczników —
[`architecture.md`](./architecture.md#1-stan-wdrożenia).

---

## 1. Jeden hub, jedno miejsce

Hub żyje **wyłącznie** w Notification —
[`SyncHub`](../../backend/modules/Notification/Notification.Api/Hubs/SyncHub.cs),
ścieżka `/hubs/sync`. Pozostałe serwisy (Catalog, Sales) nie wiedzą, że SignalR istnieje —
publikują tylko `AggregateChanged` do RabbitMQ ([`events-outbox.md`](./events-outbox.md)).
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
| `user:{userId}` | automatycznie w `OnConnectedAsync`, z query stringu połączenia | kanał `jobs` — powiadomienia trafiają wyłącznie do zleceniodawcy |
| `client:{clientId}` | jw. | zarezerwowane, dziś bez konsumenta |

**`Subscribe` jest jawne, nie automatyczne przy połączeniu.** Klient dołącza do `agg:{signature}`
dopiero, gdy faktycznie ma w cache agregaty tej sygnatury — bez tego każda otwarta karta
przeglądarki dostawałaby ruch całego ERP, niezależnie od tego, co akurat wyświetla.

> **Znany dług — brak autoryzacji.** Backend nie ma dziś warstwy uwierzytelniania (endpointy HTTP
> są `AllowAnonymous`), więc `userId`/`clientId` są czytane wprost z query stringu połączenia, bez
> weryfikacji tożsamości. Akceptowalne w fazie rozwoju — do podmiany na odczyt z `Context.User`,
> gdy powstanie JWT. Dopóki go nie ma, dowolny klient może podać cudzy `userId` i podsłuchać jego
> powiadomienia o zadaniach.

---

## 3. Koalescencja i próg inwalidacji

[`RealtimeBroadcaster`](../../backend/modules/Notification/Notification.Api/Realtime/RealtimeBroadcaster.cs)
zbiera przychodzące `AggregateChanged` w buforze per sygnatura i wysyła **jedną** wiadomość po
oknie `RealtimeBroadcastOptions.CoalesceWindow` (domyślnie 200 ms). Bez tego bulk zatwierdzający
chunk co kilkadziesiąt milisekund ([`bulk-commands.md`](./bulk-commands.md)) wysyłałby równie gęstą
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
([`bulk-commands.md`](./bulk-commands.md#6-replika-w-notification)), ale mają różnych odbiorców
i różne przeznaczenie: jeden mówi „ta encja Job się zmieniła, odśwież ją, jeśli masz w cache”,
drugi — „Twoje zadanie X się skończyło, oznacz jako przeczytane bez pytania API”.

---

## 5. Resync po luce

Problem: `withAutomaticReconnect` po stronie klienta ukrywa krótkie zerwania połączenia, ale nowe
połączenie dostaje **nowy `ConnectionId`** — SignalR nie pamięta grup między połączeniami. Zdarzenia
opublikowane w oknie rozłączenia są bezpowrotnie stracone dla tego klienta, który zostaje z cichym,
nieaktualnym cache.

### Mechanizm

[`SignatureSequenceTracker`](../../backend/modules/Notification/Notification.Api/Realtime/SignatureSequenceTracker.cs)
— monotoniczny licznik **w pamięci procesu**, per sygnatura, zwiększany raz na flush (upsert
i delete tej samej koalescencji dzielą jeden numer — to jeden „moment” z punktu widzenia klienta).

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
nie da się odtworzyć” z pierwotnego planu jest tu **zawsze prawdziwy**, bo nie ma z czego odtwarzać
— zgodne w duchu z progiem inwalidacji `all` (świadoma utrata precyzji na rzecz prostoty).

### Dlaczego restart Notification nie psuje wykrywania

Licznik jest tylko w pamięci — restart zeruje go. Nie jest to problem: restart zrywa wszystkie
połączenia SignalR, więc każdy klient i tak przechodzi przez pełne `onreconnected` → `Subscribe`
z `lastSeenSequence` sprzed restartu. Serwer widzi swoje `0`, klient pamięta np. `850` — rozjazd
wykrywa się poprawnie jako luka i wymusza resync, zamiast po cichu kłamać nieaktualnym stanem.

### Ograniczenie — jedna instancja

Przy więcej niż jednej instancji Notification każda liczy sekwencję **osobno** — mechanizm w
obecnej postaci przestaje być poprawny. To ten sam problem co przy samym rozgłaszaniu SignalR
(patrz sekcja 6) i czeka na to samo rozwiązanie: backplane.

---

## 6. Skalowanie — backplane

Notification jako centralny hub to pojedynczy punkt awarii realtime, ale **nie zapisów** — te idą
przez outbox ([`events-outbox.md`](./events-outbox.md)) i doczekają brokera. Awaria hubu degraduje
UI do „odśwież ręcznie”, nie gubi danych.

Przy >1 instancji Notification (skalowanie poziome) SignalR wymaga backplane'u (Redis) — bez niego
klient podłączony do instancji A nie dostanie wiadomości rozgłoszonej przez instancję B, a
`SignatureSequenceTracker` w obecnej, in-memory postaci liczyłby niezależnie na każdej instancji.
Konfiguracja pod backplane nie jest dziś napisana — nieużywana lokalnie, jedna instancja
Notification wystarcza na obecnym etapie.

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

- [Zdarzenia domenowe i outbox](./events-outbox.md) — skąd bierze się `AggregateChanged`
- [Operacje masowe](./bulk-commands.md) — kanał `jobs`, replika `notification.job`
- [Architektura backendu](./architecture.md)
