# Smart tabele — lista serwerowa dla agregatu

Prawie każdy agregat dostaje własny komponent tabeli: cienki Smart Component w warstwie `feature`, który spina orkiestrator (dane) z atomem `erp-table` (prezentacja, `libs/shared/ui`). Ten dokument opisuje anatomię takiego komponentu i przepis na dodanie kolejnego.

Implementacja referencyjna: [`catalog-product-table.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/components/tables/catalog-product-table/catalog-product-table.component.ts). Inne przykłady tego samego wzorca: [`notification-job-table.component.ts`](../../frontend/libs/modules/notification/feature/src/lib/job/components/notification-job-table/notification-job-table.component.ts) (własne komponenty komórek + odświeżanie po SignalR), [`identity-users-table.component.ts`](../../frontend/libs/modules/identity/feature/src/lib/users/components/tables/identity-users-table/identity-users-table.component.ts) (`selectionMode: 'single'`).

Atom, który te komponenty opakowują: [`erp-table.component.ts`](../../frontend/libs/shared/ui/src/lib/atoms/erp-table/erp-table.component.ts) + [`erp-table.builder.ts`](../../frontend/libs/shared/ui/src/lib/atoms/erp-table/erp-table.builder.ts) (wzorzec "Single Config Builder", patrz [atomy UI](./atoms.md)).

---

## 1. Gdzie to żyje i dlaczego to nie jest kolejny atom

Smart tabela mieszka w `libs/modules/MODULE_NAME/feature/src/lib/AGGREGATE/components/tables/MODULE-AGGREGATE-table/` — to warstwa `feature`, nie `ui`. Zna konkretny orkiestrator, konkretny `SearchXRequest` i konkretny `XVM` — właśnie dlatego nie może być atomem współdzielonym (atomy nie znają `data-access`, patrz granice warstw w [architekturze](./architecture.md)).

Sam komponent **nie** dostaje własnego buildera w stylu [atomów UI](./atoms.md) — ma kilka prostych `input()`/`output()` (`filters`, `stateKey`, `selectionMode`, `selectionChange`...), a całą złożoność chowa w jednym `computed<ErpTableConfig<TVm>>` budowanym przez `ErpTableBuilder` z `erp-table`. To ten sam config trafia do jedynego `[config]` inputa `<erp-table>` w szablonie.

---

## 2. Anatomia

```typescript
@Component({
  selector: 'erp-catalog-product-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `<erp-table class="block h-full w-full" [config]="tableConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogProductTableComponent {
  private readonly orchestrator = inject(CatalogProductOrchestrator);

  // ── Wejście ze strony ──
  filters = input<SearchProductRequest>({});
  stateKey = input<string>();                    // włącza zapamiętywanie stanu (patrz erp-table.builder.ts)
  selectionMode = input<ErpSelectionMode>('multi');

  // ── Wyjście do strony ──
  selectionChange = output<ErpSelectionState<ProductVM>>();
  loadingChange = output<boolean>();
  sortsChange = output<SortOption[] | undefined>();  // tylko jeśli strona tego potrzebuje — patrz §5

  // ── Stan wewnętrzny: tabela trzyma UUID-y i licznik, nie modele widoku ──
  private readonly currentUuids = signal<string[]>([]);
  private readonly totalCount = signal<number>(0);
  private readonly loading = signal<boolean>(false);
  private readonly tableComponent = viewChild(ErpTableComponent);
  private lastTableState: ErpTableState | null = null;

  public clearSelection(): void {                 // wywoływane z zewnątrz, np. akcja "Wyczyść zaznaczenie"
    this.tableComponent()?.clearSelection();
  }

  items = computed<ProductVM[]>(() => {
    const vmMap = this.orchestrator.getViewModel()();
    return this.currentUuids().map(uuid => vmMap.get(uuid)).filter((vm): vm is ProductVM => vm !== undefined);
  });

  constructor() {
    effect(() => {
      const currentFilters = this.filters();
      if (this.lastTableState !== null) {         // pierwsze pobranie robi builder.setOnStateChange
        this.fetchData(currentFilters, this.lastTableState);
      }
    });
  }

  tableConfig = computed<ErpTableConfig<ProductVM>>(() => {
    const builder = new ErpTableBuilder<ProductVM>()
      .setMode('server')
      .setRowIdAccessor(x => x.uuid)
      .setFilters(this.filters)                   // patrz §4 — po co, mimo że fetchData i tak je czyta
      .setStateKey(this.stateKey())
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(50)
      .setSelectionMode(this.selectionMode())
      .setItems(this.items)
      .setItemCount(this.totalCount)
      .setLoading(this.loading)
      .addColumn(c => c.setId('name').setAccessorKey('name').setHeader(PRODUCT_KEYS.base.table.columns.name))
      // ... kolejne addColumn / addColumnGroup

    builder
      .setOnStateChange(state => this.onTableStateChange(state))
      .setOnSelectionChange(state => this.selectionChange.emit(state));

    return builder.build();
  });

  private onTableStateChange(state: ErpTableState): void {
    const sortingChanged = !this.lastTableState
      || JSON.stringify(this.lastTableState.sorting) !== JSON.stringify(state.sorting);
    const dataStateChanged = !this.lastTableState
      || JSON.stringify(this.lastTableState.pagination) !== JSON.stringify(state.pagination)
      || sortingChanged;

    this.lastTableState = state;
    if (sortingChanged) this.sortsChange.emit(this.toSorts(state));
    if (dataStateChanged) this.fetchData(this.filters(), state);
  }

  private toSorts(tableState: ErpTableState | null): SortOption[] | undefined {
    if (!tableState?.sorting?.length) return undefined;
    return tableState.sorting.map(sort => ({ field: sort.columnId, order: sort.direction === 'asc' ? 1 : -1 }));
  }

  private async fetchData(filters: SearchProductRequest, tableState: ErpTableState | null): Promise<void> {
    this.loading.set(true);
    this.loadingChange.emit(true);
    try {
      const request: SearchProductRequest = {
        ...filters,
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,   // patrz §4 — offset paginacji
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };
      const sorts = this.toSorts(tableState);
      if (sorts) request.sorts = sorts;

      const response = await this.orchestrator.searchAsync(request, { autoLoad: true, loadOptions: { includeCategories: true } });
      this.currentUuids.set(response.uuids ?? []);
      this.totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[CatalogProductTableComponent] Error fetching data:', error);
      this.currentUuids.set([]);
      this.totalCount.set(0);
    } finally {
      this.loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
```

Osiem elementów, zawsze w tym układzie:

| Element | Rola |
|---|---|
| `filters` / `stateKey` input | wejście ze strony — filtry i (opcjonalnie) klucz zapamiętywania stanu |
| `currentUuids` + `totalCount` + `loading` signal | stan wewnętrzny — tabela pamięta **UUID-y bieżącej strony**, nie modele widoku |
| `items` computed | UUID-y → `XVM` przez `orchestrator.getViewModel()()` — dzięki temu wiersze dostają aktualizacje z SignalR za darmo, bez własnej logiki odświeżania |
| `effect()` w konstruktorze | refetch przy zmianie `filters()`, z jednym strażnikiem: nie odpalaj przed pierwszym `setOnStateChange` (patrz §4) |
| `tableConfig` computed | jedyny punkt składania `ErpTableConfig` przez `ErpTableBuilder` — kolumny, tryb, zaznaczanie, callbacki |
| `onTableStateChange` (przez `setOnStateChange`) | jedyne miejsce decydujące, czy przeliczyć sortowanie (`sortsChange`) i/lub odpytać API (`fetchData`) |
| `toSorts` | mapowanie `ErpTableState.sorting` → kontrakt HTTP `SortOption[]`, reużywane przez `fetchData` i `sortsChange` |
| `fetchData` | `async` — offset paginacji, `orchestrator.searchAsync(request, { autoLoad: true, loadOptions })`, zapis `uuids`/`totalCount`, `loading`/`loadingChange` w `finally` |

---

## 3. Przepis: nowa smart tabela dla agregatu

1. **Sprawdź, czy orkiestrator agregatu już istnieje** i ma `searchAsync`/`getViewModel()` — jeśli nie, najpierw [orkiestrator](./orchestrators.md).
2. Skopiuj strukturę z §2 (najbliższy istniejący przykład w tym samym module, jeśli jest — inaczej `catalog-product-table.component.ts`).
3. `ErpTableBuilder<TVm>` — zawsze `.setMode('server')` (tryb `'client'` jest dla list w pamięci, nie dla agregatów z paginacją API) i `.setRowIdAccessor(x => x.uuid)` — musi zwracać to samo, czego backend i SignalR używają jako identyfikatora, bo na nim opiera się zaznaczenie, cache orkiestratora i mapowanie `AggregateChanged`.
4. Kolumny: `.addColumn()` dla pojedynczej, `.addColumnGroup()` dla nagłówka nadrzędnego nad kilkoma. Prosta wartość pola → `.setAccessorKey()`; wyliczenie z wielu pól → `.setAccessorFn()`; wielolinijkowa treść z badge'ami → `.setCellRichContent()`; własny komponent Angulara (np. status z ikoną) → `.setCell(Component)`. Wyłącz sortowanie (`.setEnableSorting(false)`) na każdej kolumnie, której backend nie umie posortować (whitelist w `XQueries.ApplySorting`, patrz [CQRS](../backend/cqrs.md)) — inaczej użytkownik dostaje klik, który nic nie robi.
5. `.setEmptyMessage()` — klucz Transloco, nigdy string na sztywno (patrz [tłumaczenia](./translations.md)).
6. Zdecyduj o `selectionMode` (patrz §5) i podłącz `.setOnSelectionChange()` tylko, jeśli strona faktycznie konsumuje zaznaczenie.
7. `.setOnStateChange()` — zawsze wg wzorca z §2 (`sortingChanged`/`dataStateChanged` przez porównanie z `lastTableState`), nigdy gołe „fetchuj przy każdym stanie" — to podwaja zapytania przy zdarzeniach, które nie zmieniają zbioru danych (np. resize kolumny).
8. `fetchData` — `page = pageIndex + 1` (patrz §4), `loadOptions` dobierz do tego, co faktycznie renderują kolumny (nie dociągaj czegoś, czego żadna kolumna nie pokazuje).
9. Jeśli strona potrzebuje zasięgu zaznaczenia („Zaznacz wszystko" + panele boczne) — dopisz `.setFilters(this.filters)` i `sortsChange`, patrz [zasięg zaznaczenia](./selection-scope.md). Jeśli nie — pomiń oba, jak robi to `notification-job-table`.
10. Zarejestruj komponent w `index.ts` modułu (`feature`), jeśli ma być używany poza własnym plikiem strony.

---

## 4. Dlaczego niektóre linijki wyglądają tak, jak wyglądają

**`page: (tableState?.pagination?.pageIndex ?? 0) + 1`.** `erp-table` liczy strony od zera, kontrakt HTTP (`PagedRequest`) od jedynki. Bez tego przesunięcia backend klampuje `0` do `1` i pierwsze dwie strony tabeli zwracają ten sam zbiór, a ostatnia jest nieosiągalna.

**`if (this.lastTableState !== null)` w efekcie od `filters()`.** Pierwsze pobranie danych po wejściu na widok odpala `builder.setOnStateChange` (tabela zawsze emituje swój początkowy stan raz, przy starcie). Efekt od `filters()` ma obsłużyć wyłącznie *kolejne* zmiany filtrów — bez tego strażnika pierwsze wejście strzela dwa zapytania (jedno z efektu, jedno ze stanu początkowego tabeli).

**Nie czyść zaznaczenia ręcznie przy zmianie filtrów.** `erp-table` ma własny wewnętrzny efekt na `config().filters`, który robi to sam (`_resetSelectionOnDataShapeChange`, patrz [`erp-table.component.ts`](../../frontend/libs/shared/ui/src/lib/atoms/erp-table/erp-table.component.ts)) — identycznie przy zmianie sortowania. Warunkiem jest podanie `.setFilters(this.filters)` w builderze; **bez tego wywołania efekt tabeli nie ma czego porównywać i zaznaczenie po zmianie filtrów zostaje** (nieaktualne, celujące w poprzedni zbiór). Duplikowanie tego wywołaniem `tableComponent()?.clearSelection()` z zewnątrz jest zbędne i było błędem w tej właśnie implementacji — patrz §6.

**`.setFilters(this.filters)` przekazuje sygnał, nie jego wartość.** `this.filters` (referencja, bez `()`) trafia do configu jako `MaybeSignal`, więc `erp-table` sam go odpakowuje w swoim reaktywnym kontekście. Gdyby `tableConfig` computed czytał `this.filters()` bezpośrednio, cały config (wszystkie kolumny, callbacki) przeliczałby się przy każdej zmianie filtra — tak przelicza się tylko to, co faktycznie musi.

**`loading`/`loadingChange` w `finally`, nie po `try`.** Błąd sieciowy ma zostawić tabelę w stanie "nie ładuje" z pustą listą, a nie zawieszony spinner.

---

## 5. Warianty

**Zaznaczanie pojedynczego wiersza zamiast listy** (`identity-users-table.component.ts`) — `selectionMode` na sztywno `'single'`, `.setOnSelectionChange` mapuje `ErpSelectionState` na pojedynczy `string | null` zamiast przepuszczać cały stan:
```typescript
selectionChange = output<string | null>();
// ...
.setOnSelectionChange((state) => this.selectionChange.emit(state.selectedIds[0] ?? null))
```

**Bez zaznaczania** (`notification-job-table.component.ts`) — `.setSelectionMode('none')`, brak `selectionChange`/`setOnSelectionChange` w ogóle. Domyślny stan buildera to zresztą `'none'` (patrz `ErpTableBuilder` konstruktor) — trzeba go świadomie podnieść do `'single'`/`'multi'`.

**Własne komponenty komórek zamiast `cellRichContent`/`cellFormatter`** — gdy komórka potrzebuje własnej logiki/stylu (np. pasek postępu, badge statusu z kolorem zależnym od wartości), `.setCell(Component, inputs?)` zamiast funkcji. Patrz `JobStatusCellComponent`/`JobCommandCellComponent` w `notification-job-table`. **Tylko do wyświetlania** — komórka z przyciskiem wołającym mutację (usuń/odbierz/dezaktywuj wiersz) to inny przypadek: taka akcja idzie przez `selectionMode` + `addSelectionGroup` w `erp-action-toolbar` strony/zakładki, nie przez własny komponent komórki — patrz [pages.md §5](./pages.md#5-główna-lista-content) i [częste błędy](./pages.md#10-częste-błędy) (`IdentityRowRemoveCellComponent` w module identity to przykład tego, czego nie robić).

**Odświeżanie po zdarzeniu z SignalR, poza cyklem paginacji/filtrów** (`notification-job-table.component.ts`) — gdy nowe wiersze mogą pojawić się z zewnątrz (zlecone zadanie), a nie tylko przez zmianę filtra/strony przez użytkownika, dopnij subskrypcję do `SignalrSyncService.onUpdate(SIGNATURE)` w konstruktorze, z `debounceTime` (zbija serię szybkich zdarzeń do jednego zapytania) i publiczną metodą `reload()` do wywołania z toolbara:
```typescript
this._signalrSync.onUpdate(NOTIFICATION_JOB_SIGNATURE)
  .pipe(filter(uuids => uuids.some(u => !this._currentUuids().includes(u))), debounceTime(JOB_ARRIVAL_DEBOUNCE_MS), takeUntilDestroyed())
  .subscribe(() => this.reload());
```
Zwykłe aktualizacje istniejących wierszy (nie nowe) obsługuje sam `items` computed przez `orchestrator.getViewModel()()` — subskrypcja jest potrzebna tylko dla wierszy, których jeszcze nie ma w `currentUuids`.

**Sortowanie na wyjściu (`sortsChange`)** dodawaj tylko wtedy, gdy strona rozwiązuje UUID-y niezależnie od tabeli (materializacja „Zaznacz wszystko", podgląd w panelu bocznym — patrz [zasięg zaznaczenia §4](./selection-scope.md#4-panel-zależny-od-zaznaczenia-w-trybie-query)) i potrzebuje tej samej kolejności. Bez takiego konsumenta to martwy output.

---

## 6. Częste błędy

- **Ręczne czyszczenie zaznaczenia przy zmianie filtrów** (`tableComponent()?.clearSelection()` w efekcie od `filters()`) — zbędne, `erp-table` robi to sam (§4); wymaga jedynie `.setFilters(...)` w konfiguracji.
- **Brak `.setFilters(this.filters)`**, gdy strona potrzebuje `ErpSelectionState.filters` (zasięg „Zaznacz wszystko") albo automatycznego czyszczenia zaznaczenia po zmianie filtrów — bez tego oba mechanizmy milczą.
- **Pominięty offset `+1` przy `page`** — pierwsze dwie strony w UI zwracają identyczny zbiór, ostatnia strona jest nieosiągalna.
- **Brak strażnika `lastTableState !== null`** w efekcie od `filters()` — podwójne zapytanie przy wejściu na widok.
- **`setOnStateChange` woła `fetchData` bezwarunkowo, bez porównania `pagination`/`sorting` z `lastTableState`** — `erp-table` emituje ten callback przy **każdej** zmianie swojego wewnętrznego stanu, nie tylko przy zmianie strony/sortowania: resize kolumny, zmiana kolejności/widoczności kolumn i przełączniki w ustawieniach tabeli też przez niego przechodzą (patrz `erp-table.component.ts`, efekt emitujący `onStateChange`). Bez porównania z `lastTableState` (wzorzec z §2 — `dataStateChanged`) każde przeciągnięcie krawędzi kolumny odpala zbędne zapytanie do API. Znaleziony i naprawiony w `identity-users-table`/`identity-grant-audit-table` — obie miały gołe `this._fetchData(this.filters(), state)` w `setOnStateChange`.
- **`fetchData` wołane bezpośrednio z `setOnSelectionChange`** zamiast `setOnStateChange` — zaznaczenie nie zmienia zbioru danych, nie ma powodu robić refetch.
- **`.setEnableSorting(true)` (domyślne) na kolumnie, po której backend nie umie sortować** — klik w nagłówek nic nie robi albo (gorzej) leci do API i dostaje 400/500.
- **`rowIdAccessor` inny niż identyfikator używany przez SignalR/orkiestrator** — wiersze przestają się aktualizować w czasie rzeczywistym, zaznaczenie rozjeżdża się z cache.
- **Dociąganie w `loadOptions` czegoś, czego żadna kolumna nie renderuje** — niepotrzebne żądania do sąsiednich orkiestratorów.

---

## 7. Zobacz też

- [Page dla agregatu](./pages.md) — gdzie smart tabela mieszkuje w szkielecie całej strony (filtr, action toolbar, zakładki, panel boczny)
- [Struktura katalogów agregatu](./feature-structure.md) — dlaczego smart tabela leży w `components/tables/`, a nie w `page/`
- [Orkiestratory](./orchestrators.md) — `searchAsync`, `getViewModel()`, mapowanie DTO→VM, którym karmi się `items`
- [Zasięg zaznaczenia i akcje masowe](./selection-scope.md) — co robić z `selectionChange`/`sortsChange` na poziomie strony, „Zaznacz wszystko", panele boczne
- [Atomy UI — Single Config Builder](./atoms.md) — wzorzec, którym zbudowany jest sam `erp-table`
- [Tłumaczenia](./translations.md) — klucze dla nagłówków kolumn i `emptyMessage`
