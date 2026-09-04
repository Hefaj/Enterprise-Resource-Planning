---
id: frontend.optimistic-updates
title: Nakładki optymistyczne
summary: Nakładki optymistyczne z natychmiastowym skutkiem, rollbackiem i obsługą echa.
kind: guide
scope: frontend
audience:
  - frontend
  - agent
triggers:
  - optymistyczna aktualizacja
  - ErpOptimisticStore
related: []
---

# Nakładki optymistyczne

Każdy zapis w systemie idzie przez `BatchEndpointBase` → `job`/`job_item` → `BulkCommandRunner`
([`bulk-commands.md`](../backend/bulk-commands.md)). Endpoint zwraca `{ jobUuid }` w dziesiątki
milisekund, ale **agregat jest w tej chwili nietknięty** — wykonanie idzie w tle, asynchronicznie.
Widok, który odświeża dane zaraz po odpowiedzi HTTP, pobiera stan SPRZED własnej zmiany i wygląda
to jak zmiana, która nie weszła.

Nakładka optymistyczna pokazuje skutek mutacji NATYCHMIAST — zanim zadanie się rozstrzygnie — i
uczciwie go cofa, gdy zadanie odpadnie. To mechanizm **globalny** (`ErpOptimisticStore`,
`shared/data-access`), używany w **wybranych, pojedynczych miejscach** UI, nie wszędzie.

---

## 1. Kiedy sięgać po ten dokument

Gdy piszesz komponent, który od razu pokazuje skutek własnej mutacji użytkownikowi, który ją
wykonał — zmiana stanu na karcie, przestawienie karty na tablicy, dodanie komentarza, zapis opisu.
Jeśli Twój przypadek pasuje do listy w sekcji 7 ("Kiedy NIE stosować"), nie sięgaj po nakładkę —
zwykły `runSingleCommandAsync`/`runBatchCommandAsync` z ewentualnym refetchem po zdarzeniu
realtime wystarczy (patrz [`orchestrators.md` §6](orchestrators.md#6-komendy-mutacje)).

---

## 2. Kontrakt `ErpOptimisticOp<TValue>`

Jedna operacja to jeden obiekt przekazany do `ErpOptimisticStore.runAsync(op)`:

```typescript
export interface ErpOptimisticOp<TValue> {
  /** Sygnatura realtime tego, co nakładka patchuje — 'taskmgmt.issue', 'taskmgmt.issue_comment'.
   * Ta sama sygnatura, którą orkiestrator/cache podaje jako `signalrSignature`. */
  readonly scope: string;

  /** Uuid agregatu (dla pojedynczego obiektu) albo uuid rodzica (dla kolekcji dziecięcej —
   * np. uuid zgłoszenia dla listy komentarzy). */
  readonly key: string;

  /** Czysta funkcja patchująca — dla agregatu `TDto → TDto`, dla kolekcji `readonly T[] → readonly T[]`.
   * Wołana synchronicznie wewnątrz `project()`, bez efektów ubocznych. */
  readonly patch: (current: TValue | undefined) => TValue | undefined;

  /** Wysyła komendę i zwraca `jobUuid`. Rzut stąd (4xx, walidacja wejścia) cofa nakładkę
   * natychmiast, bez czekania na zadanie. */
  readonly dispatchAsync: () => Promise<string>;

  /** Wymuszony refetch spod nakładki. MUSI się wykonać PRZED zdjęciem nakładki. */
  readonly settleAsync: () => Promise<void>;

  /** Oddaje użytkownikowi treść, którą próbował zapisać — wołane wyłącznie przy cofnięciu. */
  readonly onRollback?: () => void;

  /** Klucz komunikatu, gdy zadanie nie poda własnego kodu błędu w `errorsSummary`. */
  readonly failureMessage?: Translatable;
}
```

Definicja: [`optimistic.types.ts`](../../../frontend/libs/shared/data-access/src/lib/optimistic/optimistic.types.ts).

Rejestr żyje w `ErpOptimisticStore` ([`optimistic.store.ts`](../../../frontend/libs/shared/data-access/src/lib/optimistic/optimistic.store.ts))
jako root-singleton — `signal<ReadonlyMap<string, readonly OptimisticEntry[]>>`, kluczowany
`${scope}|${key}`. Klucz złożony, a nie zagnieżdżona mapa, bo to jedna, prosta struktura do
przeglądania i czyszczenia — bez osobnej pętli po `scope`, gdy trzeba znaleźć jeden wpis.

**Dlaczego to nie jest część `IdentityMapStore`.** `_handleFullResync()` w `BaseOrchestrator` robi
`identityMap.clear()` na resync po rozłączeniu huba — nakładka MUSI przeżyć to czyszczenie, bo
dotyczy operacji, która wciąż trwa niezależnie od tego, co się stało z cache'm. Stąd osobny,
globalny rejestr, a nie pole na wpisie `IdentityMapStore`.

### API odczytu — czyste, wołane wewnątrz `computed()`

```typescript
project<T>(scope: string, key: string, base: T | undefined): T | undefined;
isPending(scope: string, key: string): Signal<boolean>;
pendingKeys(scope: string): Signal<ReadonlySet<string>>;
```

`project` nakłada WSZYSTKIE zarejestrowane nakładki dla `(scope, key)` na `base`, w kolejności
zgłoszenia — dwie nakładki na ten sam klucz składają się (`patch` drugiej dostaje wynik pierwszej
jako `current`). Bez aktywnej nakładki zwraca `base` bez zmian, więc jest bezpieczne wołać ją
zawsze, niezależnie od tego, czy coś akurat trwa.

### API zapisu

```typescript
runAsync<T>(op: ErpOptimisticOp<T>): Promise<void>;
awaitJobAsync(jobUuid: string, timeoutMs?: number): Promise<JobRecord | null>;
readonly rollbacks$: Observable<OptimisticRollback>;
```

`awaitJobAsync` jest publiczne, bo przydaje się poza `runAsync` — patrz `BoardStore.dropAsync`
w sekcji 9, gdzie jedna nakładka obejmuje DWIE komendy wysyłane po sobie.

---

## 3. Cykl życia `runAsync` — kolejność jest istotą mechanizmu

```
runAsync(op)
  │
  ├─ 1. rejestruj wpis (status: pending) ──────────► project() widzi nakładkę OD RAZU
  │
  ├─ 2. await op.dispatchAsync()
  │        │
  │        └─ rzut (4xx, pre-check IBatchRule) ────► ROLLBACK NATYCHMIAST (krok 5a)
  │                                                    bez czekania na zadanie
  │
  ├─ 3. czekaj reaktywnie na status końcowy zadania
  │      (completed / completedWithErrors / failed / cancelled)
  │      — toObservable(jobService.getJob(jobUuid)), NIE pętla odpytująca
  │
  ├─ 4. sukces (completed, failedCount === 0)
  │        await op.settleAsync()  ─────────────────► DOPIERO POTEM zdjęcie nakładki
  │        zdejmij nakładkę                            (odwrotna kolejność = miganie
  │                                                      starej wartości na jedną klatkę)
  │
  ├─ 5a. porażka (failed / cancelled / failedCount > 0)
  │        await op.settleAsync()
  │        zdejmij nakładkę
  │        op.onRollback?.()
  │        rollbacks$.next({ scope, key, errorsSummary, failureMessage })
  │
  └─ 6. bezpiecznik ~20 s (SETTLE_TIMEOUT_MS) — zadanie się nie rozstrzygnęło w tym czasie
           await op.settleAsync()
           zdejmij nakładkę CICHO — bez onRollback, bez rollbacks$
           (zadanie może się jeszcze udać; serwer i tak wygra zwykłym refetchem/realtime)
```

Domain-owe porażki (`DomainException` w `BulkCommandRunner`) **nie mają szansy dojść jako HTTP** —
dlatego krok 5, a nie `try/catch` wokół `dispatchAsync`, jest jedyną uczciwą ścieżką cofnięcia dla
błędów, które ujawniają się dopiero w zadaniu, a nie przy jego zleceniu.

**Dlaczego reaktywnie, nie `erpAwaitJobAsync`.** Stary helper pollował `JobService` co 200 ms z
limitem 10 s. `ErpOptimisticStore` subskrybuje `toObservable(jobService.getJob(jobUuid))` — sam
sygnał zmienia się dokładnie wtedy, gdy `JobService` dostanie coś nowego kanałem `jobs`, więc
nie ma po co odpytywać go między zdarzeniami. `erpAwaitJobAsync` (`await-job.ts`) zostaje dla
wywołań spoza nakładki — patrz sekcja 7.

---

## 4. Wpięcie A — agregaty (`BaseOrchestrator`)

`BaseOrchestrator` wstrzykuje `ErpOptimisticStore` i przepuszcza DTO przez `project()` w TRZECH
miejscach — jedynych, przez które DTO trafia do UI: `getOne()`, `getViewModel()` i
`getSignalViewModel()`, tuż przed `mapToViewModel(...)`. Konsument w `feature` nie odróżnia
agregatu z serwera od agregatu spod nakładki — dostaje jeden, spójny widok.

```typescript
// base-orchestrator.ts (skrót)
private _project(uuid: string, dto: TDto | undefined): TDto | undefined {
  return this._optimistic.project<TDto>(this.orchestratorConfig.signalrSignature, uuid, dto);
}

protected async runOptimisticCommandAsync(
  uuid: string,
  patch: (current: TDto | undefined) => TDto | undefined,
  dispatchAsync: () => Promise<string>,
  options?: { onRollback?: () => void; failureMessage?: Translatable },
): Promise<void> {
  this.identityMap.pin(uuid);
  try {
    await this._optimistic.runAsync<TDto>({
      scope: this.orchestratorConfig.signalrSignature,
      key: uuid,
      patch,
      dispatchAsync,
      settleAsync: () => this.dataLoader.reloadAsync([uuid]),
      onRollback: options?.onRollback,
      failureMessage: options?.failureMessage,
    });
  } finally {
    this.identityMap.unpin(uuid);
  }
}
```

`settleAsync` jest zawsze wymuszonym przeładowaniem TEGO agregatu (`dataLoader.reloadAsync`) —
jedyny sensowny refetch po własnej mutacji, więc wywołujący go nie podaje.

### `identityMap.pin(uuid)` / `unpin(uuid)`

`IdentityMapStore` ma `maxCacheSize` i eksmisję LRU (`lru-tracker.ts`). Bez przypięcia wpis z
aktywną nakładką mógłby wypaść z cache'u, zanim nakładka zdąży się zdjąć — wtedy `project()` nie
miałby już czego patchować (base = `undefined`). `LruTracker.evictOldest()` pomija przypięte
klucze; jeśli WSZYSTKIE wpisy są przypięte, eksmisja po prostu nic nie robi — przypiętych wpisów
jest z natury niewiele (aktywne nakładki), więc to nie jest ścieżka, którą trzeba chronić przed
nieograniczonym wzrostem.

### Konkretne metody na `TaskManagementIssueOrchestrator`

`runOptimisticCommandAsync` jest `protected` — orkiestrator wystawia PUBLICZNE, nazwane metody dla
konkretnych komend, tym samym wzorcem co `setStateAsync` → cukier na `runSingleCommandAsync`:

```typescript
public setStateOptimisticAsync(
  uuid: string,
  stateUuid: string,
  options?: { onRollback?: () => void; failureMessage?: Translatable },
): Promise<void> {
  return this.runOptimisticCommandAsync(
    uuid,
    (current) => (current ? { ...current, stateUuid } : current),
    () => this.setStateAsync({ uuid, stateUuid }),
    options,
  );
}
```

Ten sam wzorzec ma `setTypeOptimisticAsync` i `setDescriptionOptimisticAsync`
([`issue.orchestrator.ts`](../../../frontend/libs/modules/task-management/data-access/src/lib/orchestrators/issue/issue.orchestrator.ts)).

---

## 5. Wpięcie B — kolekcje dziecięce (`IssueChildCache`)

Komentarze, historia i załączniki zgłoszenia **nie są** w identity mapie — żyją w
`IssueChildCache<T>` ([`issue-child-cache.ts`](../../../frontend/libs/modules/task-management/data-access/src/lib/issue-child-cache.ts)),
zawężonym do `T extends { uuid: string }` (klucz elementu jest wymagany do wstawienia/podmiany/
usunięcia przez patch).

```typescript
public itemsOf(issueUuid: string | null | undefined): Signal<readonly T[]> {
  ...
  entry = computed(() => {
    const base = this._byIssue().get(issueUuid) ?? IssueChildCache._EMPTY;
    return this._optimistic.project<readonly T[]>(this.signature, issueUuid, base) ?? IssueChildCache._EMPTY;
  });
  ...
}

protected runOptimisticListCommandAsync(
  issueUuid: string,
  patch: (current: readonly T[] | undefined) => readonly T[] | undefined,
  dispatchAsync: () => Promise<string>,
  options?: { onRollback?: () => void; failureMessage?: Translatable },
): Promise<void> {
  return this._optimistic.runAsync({
    scope: this.signature,
    key: issueUuid,
    patch,
    dispatchAsync,
    settleAsync: async () => { await this.loadAsync(issueUuid, true); },
    onRollback: options?.onRollback,
    failureMessage: options?.failureMessage,
  });
}
```

`dispatchAsync` woła wywołujący z `feature` — kolekcja nie zna komend, bo te mieszkają w
orkiestratorze zgłoszeń (agregatem jest `Issue`, a nie element listy; patrz komentarz na
`IssueCommentService` o tym, dlaczego zapis i odczyt komentarzy mieszkają w dwóch różnych
klasach).

### Trzy buildery patchy

`issue-child-cache.ts` eksportuje gotowe funkcje, żeby żaden konsument nie pisał ręcznego
`.map`/`.filter` na liście:

```typescript
insertOptimisticItem<T>(item: T): (current) => readonly T[];               // dopisanie na końcu
replaceOptimisticItem<T>(uuid, updater: (item: T) => T): (current) => ...; // podmiana po uuid
removeOptimisticItem<T>(uuid): (current) => ...;                           // usunięcie z listy
```

**Usunięcie miękkie** (komentarz zostaje jako „usunięty”, treść znika, wpis w wątku zostaje —
[`task-management.md` §11](../../modules/task-management/domain.md#11-historia-zmian-i-komentarze)) to
`replaceOptimisticItem`, NIE `removeOptimisticItem` — patrz `IssueActivityComponent.removeAsync`.
`removeOptimisticItem` jest dla przyszłych kolekcji z prawdziwym twardym usunięciem.

### Dlaczego echo z serwera nie duplikuje wpisu

Klient generuje uuid komentarza/linku/zgłoszenia PRZED wysłaniem komendy
(`crypto.randomUUID()` w `issue.orchestrator.ts`). Orkiestrator respektuje `command.uuid`, gdy
wywołujący go poda (`addCommentAsync`, tak samo jak dotychczasowe `addLinkAsync`), więc element
wstawiony przez `insertOptimisticItem` ma DOKŁADNIE ten sam uuid, którym serwer w końcu odpowie
na kanale `taskmgmt.issue_comment`. Dwa źródła (nakładka + echo z serwera) opisują ten sam wiersz,
a nie dwa różne — dublowania nie ma.

To znosi powód, dla którego dawniej `docs/modules/task-management/screens.md` §2.3 zabraniał
optymistycznego wstawiania komentarzy: bez wspólnego uuid nakładka i echo byłyby dwoma różnymi
wierszami przez chwilę widocznymi naraz.

---

## 6. Wpięcie C — toast po cofnięciu (`ErpOptimisticRollbackBridge`)

`ErpOptimisticStore` mieszka w `shared/data-access`, `ErpToastService` w `shared/ui` — te dwie
biblioteki nie mogą się nawzajem widzieć (`type:data-access` → `{data-access, util}`, `type:ui` →
`{ui, util}`). Most żyje więc w hoście
([`erp-optimistic-rollback.bridge.ts`](../../../frontend/apps/client/src/app/erp-optimistic-rollback.bridge.ts)),
tym samym uzasadnieniem co `ErpJobToastBridge` — jedyna warstwa widząca obie naraz. Wstrzyknięty
raz w `STARTUP()`, subskrybuje `rollbacks$` i tłumaczy pierwszy kod z `errorsSummary` przez
`resolveErrorCodeKey` (`@erp/shared/ui`), z fallbackiem na `op.failureMessage`, a gdy go nie ma —
na `SHARED_KEYS.optimistic.rollback.generic`.

`parseJobErrorsSummary` jest zduplikowane (nie zaimportowane) w `shared/ui/translation/error-codes.ts`
obok `resolveErrorCodeKey` — oryginał w `@erp/notification/util` jest biblioteką `type:util` REMOTA
notification, a host nie może go statycznie zaimportować bez wciągnięcia remota do bundla.

**`notifyOnComplete` (`JobMeta`, obsługiwane przez `ErpJobToastBridge`) zostaje NIETKNIĘTE.**
Nakładka ma własną ścieżkę komunikatu (skutek widać na ekranie od razu) i nie potrzebuje toasta
o sukcesie — oba mosty się nie nakładają: `ErpJobToastBridge` obsługuje operacje BEZ nakładki
(masowe, eksporty), `ErpOptimisticRollbackBridge` — wyłącznie cofnięcia nakładek.

---

## 7. Kiedy NIE stosować nakładki

- **Tworzenie zgłoszenia.** Klucz czytelny (`DEV-123`) nadaje serwer z licznika projektu — nie ma
  czego pokazać, dopóki odpowiedź nie dojedzie.
- **Operacje masowe na wielu wierszach.** Nakładka jest kontraktem na JEDEN klucz `(scope, key)`;
  masowa zmiana na 500 wierszach to `runBatchCommandAsync` z dzwonkiem/feedem powiadomień, nie
  500 osobnych nakładek.
- **Wartość, której chwilowe zmyślenie jest kosztowne** — stany magazynowe, kwoty, cokolwiek, gdzie
  pokazanie niepotwierdzonej liczby może wpłynąć na decyzję biznesową użytkownika (np. drugie
  zamówienie na towar, który "wygląda" na dostępny).
- **Operacje bez odbiorcy, który natychmiast patrzy na skutek** — jeśli żaden ekran nie renderuje
  wyniku w tej samej chwili (np. usługa cykliczna, webhook), nakładka nic nie daje.

Dla tych przypadków zostaje dotychczasowy obrys: `runSingleCommandAsync`/`runBatchCommandAsync` +
`erpAwaitJobAsync` (`await-job.ts`) tam, gdzie ekran i tak musi poczekać na wynik, albo zwykły
refetch po zdarzeniu realtime.

---

## 8. Przepis krok po kroku

1. **Zidentyfikuj scope i key.** Scope to sygnatura realtime agregatu/kolekcji
   (`orchestratorConfig.signalrSignature` albo `IssueChildCache.signature`); key to uuid agregatu
   albo uuid rodzica kolekcji.
2. **Napisz `patch`.** Czysta funkcja, bez efektów ubocznych, operująca na `TDto`/`readonly T[]`.
   Dla kolekcji użyj gotowego buildera z sekcji 5, jeśli pasuje.
3. **Wystaw publiczną metodę `xxxOptimisticAsync`** na orkiestratorze/cache'u (nie wołaj
   `runOptimisticCommandAsync`/`runOptimisticListCommandAsync` wprost z `feature` — to `protected`
   z premedytacją, patrz [`orchestrators.md` §6](orchestrators.md#6-komendy-mutacje) o granicy
   warstw).
4. **W komponencie:** wykonaj bramki/potwierdzenia PRZED wywołaniem metody optymistycznej (dokładnie
   tak, jak dziś — `applyTransitionAsync` sprawdza `WF-004`/graf PRZED `setStateOptimisticAsync`).
   Nie owijaj wywołania w `try/catch` — `runAsync` nigdy nie rzuca, cofnięcie idzie przez
   `onRollback`/`rollbacks$`.
5. **Podaj `onRollback`, jeśli komponent ma coś do oddania użytkownikowi** (tekst z powrotem do
   edytora, powrót do trybu edycji). Dla mutacji bez lokalnego stanu do oddania (zmiana stanu,
   typu) pomiń — sam refetch wystarczy.
6. **Podaj `failureMessage`, jeśli chcesz własny komunikat** zamiast generycznego fallbacku.
7. **Zweryfikuj ręcznie**: skutek widoczny natychmiast, znika dopiero po `settleAsync`, cofnięcie
   przy wymuszonym błędzie (np. wyłącz sieć w DevTools na chwilę) pokazuje toast i oddaje stan.

---

## 9. Dwie komendy pod jedną nakładką — `BoardStore.dropAsync`

Tablica przestawia kartę w DWÓCH krokach: `setState` (jeśli kolumna docelowa niesie inny stan) i
`setCardPosition`. Zamiast dwóch osobnych nakładek, `dropAsync` rejestruje JEDNĄ — `dispatchAsync`
najpierw wysyła i CZEKA na `setState` (przez publiczne `ErpOptimisticStore.awaitJobAsync`, bez
polowania), i dopiero po jego sukcesie wysyła `setCardPosition`, którego `jobUuid` staje się tym,
na który czeka `runAsync`:

```typescript
await this._optimistic.runAsync<PendingMove>({
  scope: 'taskmgmt.board.position',
  key: board.uuid,
  patch: () => ({ cardUuid, columnUuid, index }),
  dispatchAsync: async () => {
    if (targetStateUuid !== card.stateUuid) {
      const stateJobUuid = await this._issues.setStateAsync({ uuid: card.issueUuid, stateUuid: targetStateUuid });
      const stateJob = await this._optimistic.awaitJobAsync(stateJobUuid);
      if (!stateJob || stateJob.status !== 'completed' || stateJob.failedCount > 0) {
        throw new Error('taskmgmt.transition_not_allowed'); // krok 2 cyklu życia: rollback natychmiast
      }
    }
    return this._boards.setCardPositionAsync(setPosition);
  },
  settleAsync: () => this._boards.refreshCardsAsync(),
  onRollback: () => this._toast.show({ message: BOARD_KEYS.move.failed, appearance: 'negative' }),
});
```

Scope tablicy (`taskmgmt.board.position`) jest CELOWO różny od sygnatury cache'u kart
(`taskmgmt.board`) — to nie jest patch na pojedynczej karcie (`BoardCardDto`), tylko na „gdzie w
kolumnie leży przeciągana karta”; `BoardStore.columns` czyta go osobno przez `project()` i
wstawia kartę do właściwej kolumny w obliczonym widoku, dokładnie tak jak dawny lokalny sygnał
`_pendingMove`, którego to wpięcie zastępuje.

To jest wzorzec dla KAŻDEJ operacji złożonej z kilku komend pod jedną nakładką: `dispatchAsync`
odpowiada za całą sekwencję i zwraca `jobUuid` OSTATNIEJ komendy — `runAsync` śledzi tylko ten
jeden job.

---

## 10. Backend — dlaczego zadanie rozstrzyga się szybciej niż kiedyś

Bez zmian po stronie backendu mechanizm wciąż działa, ale nakładka wisi 2–3 s (pełny
`BulkJobOptions.IdlePollingInterval`) zamiast typowych kilkudziesięciu milisekund — `JobStore.CreateAsync`
budzi teraz `IJobQueueSignal` (proces-lokalny, `SemaphoreSlim`) zaraz po commicie `MarkAccepted()`,
a `BulkCommandRunner` czeka na ten sygnał zamiast na stały `Task.Delay`. Poll zostaje jako sufit —
patrz [`bulk-commands.md` §3](../backend/bulk-commands.md#3-wykonanie--bulkcommandrunner).

---

## Instrukcja dla agenta

Zanim dodasz nowe wpięcie nakładki: sprawdź listę w sekcji 7 — jeśli operacja pasuje do
któregokolwiek punktu, NIE dodawaj nakładki, zostań przy zwykłym `runSingleCommandAsync`/
`erpAwaitJobAsync`. Jeśli pasuje, trzymaj się przepisu z sekcji 8 co do joty: publiczna metoda
`xxxOptimisticAsync` na orkiestratorze/cache'u (nigdy bezpośrednie wołanie `runOptimisticCommandAsync`
z `feature`), bramki PRZED wywołaniem, `patch` bez efektów ubocznych. Gdy operacja to więcej niż
jedna komenda (jak `BoardStore.dropAsync`), użyj wzorca z sekcji 9 — `awaitJobAsync` do
pośrednich kroków, `runAsync` tylko wokół ostatniego. Nie dodawaj nowego `try/catch` wokół
wywołania metody `xxxOptimisticAsync` — `runAsync` nigdy nie rzuca.

---

## Zobacz też

- [Orkiestratory (`data-access`)](orchestrators.md) §6 — obrys komend, `runOptimisticCommandAsync`
  jako czwarty wariant
- [Operacje masowe (backend)](../backend/bulk-commands.md) §3 — `BulkCommandRunner`, `IJobQueueSignal`
- [Podział na strony w Task Management](../../modules/task-management/screens.md) §2.2/§2.3 — pilotaż na tablicy
  i karcie zgłoszenia
- [Task Management (backend)](../../modules/task-management/domain.md) §7.3 — BRD-003, cofanie optymistycznego ruchu
- [Powiadomienia na froncie](notifications.md) — `ErpToastService`, `JobService`, `erpAwaitJobAsync`
