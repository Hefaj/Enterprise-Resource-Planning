# Atomy UI — wzorzec "Single Config Builder"

Atomy i molekuły UI współdzielone (`libs/shared/ui/**`, np. `erp-button`, `erp-input-text`) nie przyjmują dziesiątek osobnych `@Input()` — przyjmują **jeden obiekt konfiguracji**, złożony fluent-API builderem.

---

## 1. Dlaczego jeden `config`, a nie wiele `@Input()`

Rozproszone `@Input()` mają dwa problemy przy komponentach współdzielonych, używanych w wielu modułach: (1) każdy nowy opcjonalny parametr to nowy input do przekablowania we wszystkich miejscach użycia, i (2) nie da się łatwo przekazać "gotowej konfiguracji" zbudowanej warunkowo w kodzie (np. w `computed()`) bez rozbijania jej z powrotem na osobne pola w szablonie.

Single Config Builder rozwiązuje to przez **jeden punkt wejścia**: komponent ma dokładnie jeden `input.required<XConfig>()`, a `XBuilder` daje czytelne, fluent API do złożenia tej konfiguracji tam, gdzie jest tworzona (zwykle w Smart Component z warstwy `feature`).

---

## 2. Struktura trzech plików

```
libs/shared/ui/src/lib/[component-name]/
├── [component-name].types.ts       # XConfig — kontrakt
├── [component-name].builder.ts     # XBuilder — fluent API do złożenia XConfig
├── [component-name].component.ts   # komponent — jeden input, reszta to computed()
└── index.ts
```

### `[component-name].types.ts`

Definiuje `XConfig` — interfejs opisujący **wszystko**, co komponent potrzebuje do wyrenderowania się. Każde pole jest `MaybeSignal<T>` (`T | Signal<T>`), żeby wywołujący mógł przekazać albo stałą wartość, albo sygnał reaktywny — komponent nie musi wiedzieć, które z nich dostał.

```typescript
export type MaybeSignal<T> = T | Signal<T>;

export interface XConfig {
  readonly label: MaybeSignal<string>;
  readonly disabled?: MaybeSignal<boolean>;
  // ...
}
```

### `[component-name].builder.ts`

`XBuilder` rozszerza `ErpBaseBuilder<XConfig>` i daje fluent API (`setLabel()`, `setDisabled()`...) plus statyczny `create()`. Builder to miejsce, gdzie warunkowa logika składania configu (np. "pokaż X tylko gdy Y") żyje w jednym czytelnym łańcuchu wywołań, zamiast rozproszonych `[attr]`/`*ngIf` w szablonie wywołującego.

### `[component-name].component.ts`

- `standalone: true`, jeden input: `config = input.required<XConfig>()`.
- Każde pole configu odpakowywane przez `computed()` — to miejsce, gdzie `MaybeSignal<T>` faktycznie staje się zwykłym `Signal<T>` do użycia w szablonie, niezależnie od tego, czy wywołujący podał stałą czy sygnał.
- Akcje asynchroniczne (`onClick`, `onAction`) dostają własny `internalLoading = signal(false)`, ustawiany automatycznie wokół wywołania — komponent sam pokazuje stan ładowania, wywołujący nie musi o tym pamiętać przy każdym użyciu.
- Layout: Tailwind CSS v4. Logika/wygląd bazowy: TaigaUI.

---

## 3. Kiedy sięgać po ten wzorzec

Dla atomów/molekuł w `libs/shared/ui/**`, które będą używane w wielu modułach — tam korzyść ze scentralizowanej, fluent konfiguracji jest największa. Dla komponentów specyficznych dla jednego modułu (`libs/modules/MODULE_NAME/ui/**`) stosuj ten wzorzec tylko, jeśli konfiguracja faktycznie jest złożona (kilka warunkowych pól) — prosty komponent z 2-3 inputami nie potrzebuje buildera.

---

## 4. Backend (jeśli komponent wymaga nowego endpointu)

Backend to .NET 10 — Minimal APIs, silne typowanie DTO. DTO ma odpowiadać configowi frontendu; moduł woła bezpośrednio API swojego mikroserwisu (brak warstwy BFF/agregacji, patrz [CLAUDE.md](../../CLAUDE.md)).

---

## 5. Potwierdzanie akcji — jeden atom dla wszystkich modułów

Pytanie „czy na pewno" jest elementem języka UI, nie domeny — nie pisz modułowego serwisu
potwierdzeń (były dwa, `CatalogConfirmDialogService` i `IdentityConfirmDialogService`, i były
tym samym kodem). Moduł wnosi wyłącznie klucze tłumaczeń:

```typescript
private readonly _confirm = inject(ErpConfirmDialogService);

// Domyślna forma: „zapytaj i zleć". Akcja idzie WEWNĄTRZ okna — przycisk pokazuje spinner
// do jej końca, drugie kliknięcie jest zablokowane, a wycofanie się użytkownika po prostu
// zwraca `false` (nie jest błędem).
void this._confirm
  .confirmThenAsync(
    ErpConfirmDialogBuilder.create(b =>
      b.setKeys(PRODUCT_KEYS.base.multimedia.confirm.clearAll, { count }).setDestructive(),
    ),
    () => this._orchestrator.setMultimediaMultipleAsync(payload, QUEUE_ID),
  )
  .catch((err: unknown) => console.error('[MultimediaTabComponent] …', err));
```

Gołe `confirm(...)` / `confirmAsync(...)` zostaje dla przypadków, w których po potwierdzeniu nie
ma jednej akcji do wykonania (rozgałęzienie, zmiana stanu lokalnego, kilka niezależnych ścieżek).

- `setKeys({ title, message, yes, no }, params)` bierze całą gałąź słownika naraz — to konwencja
  słowników modułowych. Klucze rozsypane po innych nazwach składasz `setTitle`/`setMessage`/
  `setConfirmLabel`/`setCancelLabel`.
- Do dialogu idzie **klucz**, nie gotowy tekst — treść rozwiązuje pipe `erpTranslate` w szablonie
  atomu, więc przełączenie języka przerysowuje otwarte okno. Liczby (`{ count }`) przechodzą jako
  parametry interpolacji: potwierdzenie bez liczby nie mówi, jaki jest promień rażenia.
- `setDestructive()` / `setAppearance('warning')` ustawia ikonę i kolor przycisku — użytkownik ma
  poznać po samym oknie, czy klika „zapisz", czy „skasuj".
- Strumień emituje **dokładnie jedną** wartość: `false` obejmuje też zamknięcie backdropem, więc
  nie ma trzeciego stanu do obsłużenia. Dla `async/await` jest `confirmAsync(...)`.
- `confirmThenAsync(config, action)` to `confirmAsync` + `setOnConfirm(action)` w jednym: zwraca
  `true`, gdy akcja poszła, `false`, gdy użytkownik się wycofał; błąd akcji zamyka okno i leci
  do wywołującego. `setOnConfirm(fn)` wprost przydaje się, gdy konfigurację składasz gdzie indziej
  niż wywołujesz dialog.
- **Potwierdzenie zawsze zostaje w `feature`/`ui` — nigdy nie wędruje do orkiestratora.**
  Uzasadnienie (granice warstw, kontekst treści, „anulowano" ≠ błąd) →
  [`orchestrators.md` §6](./orchestrators.md#6-komendy-mutacje).

---

## Zobacz też

- [Architektura frontendu](./architecture.md) — gdzie w drzewie zależności żyje `ui` względem `feature`/`data-access`
