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

## Zobacz też

- [Architektura frontendu](./architecture.md) — gdzie w drzewie zależności żyje `ui` względem `feature`/`data-access`
