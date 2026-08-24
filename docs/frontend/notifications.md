# Powiadomienia — toast, dzwonek, historia zadań

Trzy powierzchnie, jedna zasada. Wszystko opisane niżej **jest w kodzie**: dzwonek, feed zadań,
strona historii, akcja pobrania artefaktu i `ErpToastService` ze stosem toastów.

---

## 1. Trzy powierzchnie i jedna zasada

| Powierzchnia | Trwałość | Do czego |
|---|---|---|
| **Toast** | sekundy, ulotny | „stało się teraz, może chcesz kliknąć" |
| **Dzwonek** (popover) | sesja + replika serwera | ostatnie zadania, licznik nieprzeczytanych |
| **Historia zadań** (strona) | do `job.expire_on` | źródło prawdy, filtry, paginacja |

> **Zasada: toast nigdy nie jest jedynym miejscem.** Jeśli informacja istnieje wyłącznie w toaście,
> użytkownik traci ją przez mrugnięcie okiem albo przez przypadkowe kliknięcie. Wszystko, co warto
> zatoastować, musi dać się odnaleźć w dzwonku albo w historii.

---

## 2. Co już istnieje

| Element | Plik |
|---|---|
| Kanał `jobs` → grupa `user:{userId}` | backend, [`realtime-signalr.md`](../backend/realtime-signalr.md) |
| Store feedu (root singleton) | [`job.service.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/job.service.ts) |
| Zasilanie z repliki serwera | [`job-feed.service.ts`](../../frontend/libs/modules/notification/data-access/src/lib/orchestrators/job/job-feed.service.ts) |
| Dzwonek w nagłówku (dumb) | [`erp-notifications.component.ts`](../../frontend/libs/client/ui/src/lib/erp-notifications/erp-notifications.component.ts) |
| Lista pod dzwonkiem (lazy z remota) | [`job-list.component.ts`](../../frontend/libs/modules/notification/feature/src/lib/job/job-list/job-list.component.ts) |
| Wiersz zadania (dumb) | [`erp-job-item.component.ts`](../../frontend/libs/modules/notification/ui/src/lib/erp-job-item/erp-job-item.component.ts) |
| Strona „Historia zadań" | [`job.component.ts`](../../frontend/libs/modules/notification/feature/src/lib/job/page/job.component.ts) |
| Toast — atom, builder, serwis | [`erp-toast/`](../../frontend/libs/shared/ui/src/lib/atoms/erp-toast) |
| Stos toastów (host) | [`erp-toast-host.component.ts`](../../frontend/apps/client/src/app/erp-toast-host.component.ts) |
| Automatyczny toast po zadaniu | [`erp-job-toast.bridge.ts`](../../frontend/apps/client/src/app/erp-job-toast.bridge.ts) |
| Pobranie artefaktu z feedu | [`job-download.service.ts`](../../frontend/libs/modules/notification/feature/src/lib/job/job-download.service.ts) |
| Rejestr wyników zadań | [`erp-job-result-registry.service.ts`](../../frontend/libs/shared/data-access/src/lib/jobs/erp-job-result-registry.service.ts) |

`JobService` mieszka w `shared/data-access`, a nie w module notification, celowo: licznik przy
dzwonku musi być znany hostowi, zanim ktokolwiek kliknie i pociągnie remota. Store jest zasilany
z dwóch stron — optymistycznie przez orkiestrator w chwili otrzymania `jobUuid` i realnie przez
replikę serwera — scalanych po `trackingID`.

---

## 3. Gdzie użytkownik ponownie znajdzie wynik

Zamknięcie toasta ani popovera **nie traci niczego**: zadanie jest wierszem w bazie zreplikowanym
do Notification, przeżywa odświeżenie strony i restart procesu. Dostępne z dwóch miejsc:
popover pod dzwonkiem (ostatnie `JOB_POPOVER_LIMIT` pozycji, stopka „Pokaż wszystkie") i strona
historii z menu modułu notification.

Dla zadań produkujących artefakt ([`exports-artifacts.md`](../backend/exports-artifacts.md))
dochodzą trzy rzeczy, o których trzeba pamiętać:

1. **Akcja pobrania jest w `erp-job-item`** (popover) i w `JobDownloadCellComponent` (tabela
   historii), ale decyzję „czy pokazać" podejmuje w obu jeden serwis — `JobDownloadService`.
   Rozdzielenie tej logiki skończyłoby się tym, że w jednym miejscu przycisk jest, a w drugim nie.
2. **Zadania z artefaktem są wyłączone z „Wyczyść zakończone".** Ta akcja czyści wyłącznie lokalny
   store, ale przy pozycji z przyciskiem „Pobierz" czyta się jak „skasuj plik" — a plik zostaje
   w magazynie do `expireOn` niezależnie od tego, co użytkownik zrobi z listą.
   Stąd `JobService.clearFinished(keep?)` z predykatem ochronnym.
3. **Po `expireOn` akcja znika.** Pokazywanie przycisku prowadzącego do wygasłego artefaktu jest
   gorsze niż niepokazywanie go wcale.

### Jak feed sięga po artefakt z cudzego modułu

Feed mieszka w remocie `notification`, a artefakt produkuje Catalog. Granice NX zabraniają
`scope:notification` sięgnąć do `scope:catalog` — i słusznie, bo inaczej każdy nowy eksport
w systemie oznaczałby zmianę w module powiadomień.

Rozwiązuje to `ErpJobResultRegistry` (`shared/data-access`), tym samym wzorcem co widżety i modale:

1. Kontrakt remota wystawia `remoteJobResultCommandTypes` i `loadJobResultResolver()`.
2. Host rejestruje je przy STARTUP — kontrakty **wszystkich** remotów ładują się wtedy tak czy
   inaczej, bo host potrzebuje ich do menu. Przycisk „Pobierz" działa więc od pierwszej sekundy,
   a nie dopiero po tym, jak użytkownik odwiedzi moduł produkujący eksport.
3. Sam resolwer zostaje leniwy — `data-access` Catalogu dociąga się przy pierwszym kliknięciu.

Link powstaje **dopiero w tym momencie** i nigdzie nie jest zapamiętywany: presigned URL jest
bearer-owy, więc jego jedynym zabezpieczeniem jest krótki TTL.

---

## 4. `ErpToastService` — gdzie mieszka i dlaczego

Dwa ograniczenia wyznaczają rozmieszczenie jednoznacznie.

**Native Federation.** Serwis musi być w bibliotece `@erp/shared/*`, bo tylko one jadą jako
`shared: singleton` w `federation.config.mjs` — jedna instancja na host i wszystkie remote'y.
Poprzedni `ErpToastBridgeService` leżał w `apps/client`, więc **żaden remote nie mógł go
zaimportować**: kod aplikacji hosta nie jest eksponowany przez federację. Położenie go
w `@erp/MODULE/data-access` byłoby jeszcze gorsze — te biblioteki są w tablicy `skip` (dla Vite
HMR), więc każdy remote dostałby własną kolejkę, a toast wywołany z katalogu nigdy nie dotarłby
do komponentu renderującego w hoście. Cicha awaria, bardzo trudna do zdiagnozowania.

**Granice warstw wyznaczają resztę — i to inaczej, niż podpowiada intuicja.** `ErpToastConfig`
niesie `Translatable` i `ErpIcon`, czyli typy z `shared/ui`. Ponieważ `type:data-access` może
zależeć wyłącznie od `{data-access, util}`, **warstwa danych nie zobaczy tego kontraktu** —
a `shared/util` w tym repo nie istnieje. Dlatego serwis stoi przy swoim typie, w `shared/ui`:

```text
libs/shared/ui/src/lib/atoms/erp-toast/     ← atom + kontrakt + kolejka
├── erp-toast.types.ts        # ErpToastConfig
├── erp-toast.builder.ts      # ErpToastBuilder
├── erp-toast.component.ts    # jeden input: config, zero serwisów
├── erp-toast.service.ts      # root singleton: show / update / dismiss
└── index.ts

apps/client
├── erp-toast-host.component.ts   # stos: czyta z serwisu, renderuje N atomów
└── erp-job-toast.bridge.ts       # JobService (data-access) → ErpToastService (ui)
```

Konsekwencja jest jedna i do zaakceptowania: **kod z `data-access` nie wystrzeli toasta
bezpośrednio.** Robi to za niego host — jedyna warstwa widząca obie strony. Ten sam układ
co przy dzwonku powiadomień i rejestrze wyników zadań.

Atom idzie wzorcem z [`atoms.md`](./atoms.md) — jeden `input.required<ErpToastConfig>()`, reszta
przez `computed()`.

---

## 5. Kontrakt

```typescript
export interface ErpToastConfig {
  readonly id?: string;
  readonly message: MaybeSignal<Translatable>;   // KLUCZ tłumaczenia, nie tekst
  readonly appearance?: MaybeSignal<'info' | 'positive' | 'warning' | 'negative'>;
  readonly icon?: MaybeSignal<string>;
  readonly autoCloseMs?: number | null;          // null = trwały, zamykany ręcznie
  readonly action?: {
    readonly label: Translatable;
    readonly onClick: () => void | Promise<void>;
  };
}
```

```typescript
show(config: ErpToastConfig): string              // zwraca id
update(id: string, patch: Partial<ErpToastConfig>): void
dismiss(id: string): void
```

---

## 6. Pięć decyzji, które trzeba podjąć świadomie

1. **Klucz tłumaczenia, nie `string`.** Dzisiejsze `show(message: string)` zmusza wołającego do
   `transloco.translate(...)` w miejscu wywołania — tak robi interceptor 403. Łamie to regułę
   „zero hardcoded stringów" i dodatkowo **zamraża język w momencie wystrzelenia**: przełączenie
   języka nie odświeży widocznego toasta. Klucz + `erpTranslate` w szablonie załatwia oba.

2. **Stos, nie pojedynczy toast.** Dziś `current` to jeden sygnał — drugi toast kasuje pierwszy.
   Koniec operacji masowej i 403 z równoległego żądania potrafią przyjść razem.

3. **`id` daje toast żyjący przez całą operację.** `show()` → „generuję raport…" →
   `update(id, …)` → „raport gotowy [Pobierz]". Bez `id` powstają dwa osobne toasty i użytkownik
   nie widzi, że to ta sama rzecz.

4. **Toast z akcją nie może się auto-zamykać.** Dziś w komponencie jest zaszyte
   `setTimeout(..., 5000)` — za mało, żeby zdążyć przeczytać i kliknąć. Przy `action` ustaw
   `autoCloseMs: null`.

5. **`role` zależy od wagi.** `alert` dla `negative`/`warning`, `status` dla reszty — `alert`
   przerywa czytnikowi ekranu w pół zdania i należy się temu, co poszło źle, a nie potwierdzeniu
   zapisu. Poprzednia implementacja dawała `alert` wszystkiemu.

---

## 7. Kto odpala toast dla zadania

Nie orkiestrator konkretnego modułu i **nie sam `JobService`** — ten wie, kiedy zadanie się
kończy, ale mieszka w `data-access` i nie ma prawa zobaczyć `ErpToastService` z `ui` (patrz §4).
Spina je `ErpJobToastBridge` w hoście: `effect` nad feedem zadań, który dla zakończonego zadania
z flagą wystrzeliwuje toast.

W remocie `notification` też nie — jego warstwa `feature` ładuje się leniwie, dopiero gdy ktoś
otworzy panel albo historię, a toast po zakończeniu długiego eksportu ma przyjść niezależnie od
tego, gdzie użytkownik akurat jest.

Most czeka na **rozstrzygnięty status**: `isComplete` przychodzi kanałem `jobs` przed dokładnym
stanem z repliki, więc toast „zakończono" wystrzelony od razu byłby zmyśleniem sukcesu dla
zadania, które właśnie poległo. Trzyma też zbiór już powiadomionych `trackingID` — rekord zmienia
się jeszcze po zakończeniu, a bez tego jedno zadanie dałoby trzy identyczne toasty.

Ale **nie toastuj każdego zadania** — przy operacjach masowych to spam. Opt-in idzie przez
`JobMeta`, które już istnieje i, co ważne, **przeżywa odświeżenie strony**, bo backend trzyma je
jako `job.ui_metadata` i oddaje w `JobDto`. Orkiestrator ustawia flagę przy zlecaniu:

```typescript
meta: {
  commandName: PRODUCT_KEYS.commands.export,
  notifyOnComplete: true,
}
```

Efekt uboczny jest korzystny: jeśli użytkownik odświeży stronę w trakcie generowania, toast po
zakończeniu i tak się pojawi — intencja jest zapisana po stronie serwera, nie w pamięci karty.

---

## 8. Czego nie zmieniać

**Nie wracaj do `TuiAlertService`.** Jego konstruktor (`TuiPortal` → `TuiPopupService`) rozwiązuje
się wyłącznie w kontekście wewnętrznego `<tui-popups>` z szablonu `TuiRoot`, a content projection
(`<ng-content>`, czyli m.in. `<router-outlet>`) dostaje injector z miejsca **deklaracji**, nie
z pozycji w drzewie DOM — stąd `NG0201` przy każdej próbie wstrzyknięcia poza `TuiRoot`.
Samodzielny banerek stylowany tokenami `--tui-*` omija to bez grzebania w wewnętrznym API
TaigaUI i jest właściwą decyzją. Przenosząc kod do `shared/ui`, zachowaj to podejście.

---

## 9. Zobacz też

- [Atomy UI](./atoms.md) — wzorzec Single Config Builder
- [Orkiestratory](./orchestrators.md) — skąd biorą się wpisy optymistyczne w feedzie
- [Tłumaczenia](./translations.md) — dlaczego klucz, a nie tekst; DI shadowing
- [Eksporty i artefakty](../backend/exports-artifacts.md) — strona backendowa
- [Realtime SignalR](../backend/realtime-signalr.md) — kanały `jobs` i `agg:`
