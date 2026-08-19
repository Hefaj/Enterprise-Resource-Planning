# Page dla agregatu — szkielet, zakładki, panel zależny od zaznaczenia

Ten dokument opisuje anatomię typowego **page** modułu: widoku listującego agregat (np. produkty, użytkownicy), z filtrami, tabelą serwerową, akcjami masowymi i (opcjonalnie) zakładkami. Cel: każdy kolejny page ma wyglądać i działać tak samo, żeby użytkownik uczący się jednego ekranu rozumiał od razu wszystkie pozostałe.

Implementacja referencyjna: strona produktów katalogu —
[`product.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/product.component.ts) (szkielet siatki),
[`product.store.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/product.store.ts) (store strony — filtry, sortowanie, zaznaczenie, zasięg),
[`product-filter.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/filters/product-filter.component.ts) (filtry),
[`product-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/product-tab.component.ts) (pierwsza zakładka — lista),
[`catalog-product-table.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/components/catalog-product-table/catalog-product-table.component.ts) (smart tabela),
[`product-scope-tab.store.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/product-scope-tab.store.ts) + [`multimedia-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/multimedia/multimedia-tab.component.ts) / [`warranty-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/warranty/warranty-tab.component.ts) (panele boczne zależne od zaznaczenia).

Wariant bez akcji masowych (pojedynczy wybór wiersza zamiast zasięgu): [`users.component.ts`](../../frontend/libs/modules/identity/feature/src/lib/users/users.component.ts) + [`users.store.ts`](../../frontend/libs/modules/identity/feature/src/lib/users/users.store.ts) — patrz §7.

Dokumenty, na których ten się opiera i których nie powiela: [smart tabele](./smart-tables.md) (anatomia `erp-catalog-product-table`), [zasięg zaznaczenia](./selection-scope.md) (`ErpSelectionScope`, materializacja, bramkowanie toolbara), [atomy UI](./atoms.md) (wzorzec Single Config Builder, którym zbudowane są `erp-grid-layout`, `erp-tabs`, `erp-table`, `erp-action-toolbar`).

---

## 1. Szkielet: `erp-grid-layout`

Page to zawsze jeden komponent renderujący `<erp-grid-layout [config]="pageConfig" />` — cała struktura wizualna (filtr / zakładki / treść / panel) jest deklaracją w `ErpGridLayoutBuilder`, nie w szablonie HTML:

```typescript
@Component({
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [ProductStore, provideProductTranslations()],
  template: `<erp-grid-layout [config]="pageConfig" />`,
  styles: [`:host { display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  protected readonly activeTabId = signal<string | null>('products');

  protected readonly tabsConfig = ErpTabsBuilder.create(b => b
    .setLayout('horizontal')
    .withSharedState(this.activeTabId)
    .addTab('Lista produktów', 'products', { icon: '@tui.list' })          // bez `component` — patrz §3
    .addTab(PRODUCT_KEYS.base.tabs.multimedia, 'multimedia', { component: MultimediaTabComponent, icon: '@tui.image' })
    .setInitialValue('multimedia')
    .setOnTabChange(noop)
  );

  private readonly store = inject(ProductStore);

  protected readonly pageConfig = ErpGridLayoutBuilder.create(b => b
    .setLayoutId('catalog-products-page')
    .setShowBorders(true)
    .setGrid({
      areas: ['filter tabs    tabs', 'filter content rightPanel'],
      columns: '280px 1fr 280px',
      rows: 'auto 1fr',
      gap: '0',
    })
    .fill('filter', ProductFilterComponent)
    .fill('tabs', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'tabs' })
    .fill('content', ProductTabComponent)
    .fill('rightPanel', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'content' }, {
      resizable: 'left',
      minWidth: 600,
      maxWidth: 1600,
      collapsed: computed(() => this.activeTabId() === 'products'),
    })
  );
}
```

Cztery obszary, zawsze te same nazwy i ta sama rola:

| Area | Zawartość | Zawsze obecny? |
|---|---|---|
| `filter` | `erp-filter` opakowany w komponent strony (patrz §2) | tak |
| `tabs` | nagłówki zakładek (`ErpTabsComponent` z `renderMode: 'tabs'`) | tylko gdy są zakładki (patrz §3) |
| `content` | stała lista agregatu — action toolbar + smart tabela (patrz §4) | tak |
| `rightPanel` | treść aktywnej zakładki (`ErpTabsComponent` z `renderMode: 'content'`), przeciągalny i chowany | tylko gdy są zakładki |

Jeśli page **nie ma** zakładek (patrz §3), grid ma tylko `filter` i `content` — bez `tabs`/`rightPanel` i bez `ErpTabsBuilder` w ogóle.

`setLayoutId(...)` musi być unikalny w aplikacji — pod tym kluczem zapisują się preferencje użytkownika (szerokości kolumn resizowalnych obszarów).

---

## 2. Filtry (`filter`)

Osobny Smart Component w `page/filters/`, wstrzykujący store strony i budujący `ErpFilterConfig` przez `ErpFilterBuilder`:

```typescript
@Component({
  selector: 'erp-product-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig"></erp-filter>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent {
  private readonly store = inject(ProductStore);

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create(b => b
    .setFilterKey('product-list')                 // klucz presetów zapisywanych przez użytkownika
    .setInitialValues(computed(() => this.store.filters()))
    .setOnSearch(val => this.store.updateFilters(val))
    .setLoading(this.store.loading)
    .addFormField('productId', 'text', f => f.setLabel('ID produktu'))
    // ... kolejne addFormField / addCustomFormField
  );
}
```

- `setOnSearch` woła **wyłącznie** `store.updateFilters(...)` (albo `setFilters`, jeśli formularz zawsze zastępuje cały filtr) — filtr nigdy nie trzyma własnej kopii stanu wyników, store jest jedynym źródłem prawdy.
- Zapisywanie/wczytywanie presetów idzie przez `ErpUserPreferencesService`, z kluczem `erp-filter-${filterKey}` — skopiuj wzorzec `onSavePreset`/`onLoadPreset`/`onDeletePreset` z `product-filter.component.ts`, nie odtwarzaj go inaczej.
- Pole niestandardowe (np. picker drzewa kategorii) idzie przez `.addCustomFormField(key, Component, config)`, nie przez rozszerzanie `erp-filter` o nowy typ pola.

---

## 3. Zakładki albo ich brak

**Nie dodawaj zakładek, jeśli page ma tylko tabelę i akcje.** Wtedy `content` renderuje bezpośrednio wrapper action-toolbar + smart tabela (patrz §4), grid ma dwa obszary (`filter`, `content`), a `ErpTabsBuilder`/`rightPanel` w ogóle nie istnieją w komponencie.

**Jeśli page trzeba podzielić na zakładki, obowiązują dwie zasady bez wyjątków:**

1. **Pierwsza zakładka to zawsze lista, bez prawego panelu.** W `tabsConfig` pierwszy `addTab(...)` (id `'products'` w przykładzie) **nie dostaje** `component` — bo jego treść nie renderuje się przez `ErpTabsComponent renderMode:'content'` w `rightPanel`, tylko osobno, w obszarze `content` (`.fill('content', ProductTabComponent)`). `rightPanel` chowa się, gdy ta zakładka jest aktywna:
   ```typescript
   .fill('rightPanel', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'content' }, {
     collapsed: computed(() => this.activeTabId() === 'products'),
   })
   ```
   Wymaga to `activeTabId` (`signal<string | null>`) współdzielonego między `tabsConfig` (`.withSharedState(this.activeTabId)`) a warunkiem `collapsed` — to jedyny sposób, w jaki `rightPanel` wie, która zakładka jest aktywna.

2. **Każda kolejna zakładka to panel zależny od zaznaczenia w głównej tabeli** — musi wspierać zaznaczenie wielokrotne (nie pojedynczy wiersz) i renderować się w `rightPanel`, z `component` ustawionym w `addTab(...)`. Zasady budowy takiego panelu — patrz §6.

`ErpTabsComponent` renderowany dwa razy z **tym samym** `tabsConfig` (raz `renderMode: 'tabs'` w obszarze `tabs`, raz `renderMode: 'content'` w `rightPanel`) to jedyny poprawny sposób rozdzielenia nagłówków zakładek od ich treści między dwa obszary siatki — nie twórz dwóch osobnych konfiguracji ani nie renderuj zakładek ręcznie w `content`.

Zagnieżdżone pod-zakładki (np. „Oferta sprzedażowa” → „Wykluczenia” / „Dostawa”) idą przez `children: [...]` w `addTab(...)` — patrz `sales-offer-tabs/` w przykładzie referencyjnym.

---

## 4. Store strony — jedno źródło prawdy o filtrach i zaznaczeniu

Store strony (`page/AGGREGATE.store.ts`, `@Injectable()` rejestrowany w `providers` komponentu page — żyje tylko tyle, co widok) trzyma:

1. **Filtry** (`signal<Partial<SearchXRequest>>`) — z `setFilters`/`updateFilters`.
2. **Sortowanie** (`signal<SortOption[] | undefined>`) — osobno od filtrów, bo żyje w stanie tabeli, ale store go potrzebuje do zapytań o same UUID-y (patrz punkt 3).
3. **Zaznaczenie** (`signal<ErpSelectionState<XVM> | null>`) i **zasięg** (`computed<ErpSelectionScope<XVM, SearchXRequest>>` przez `erpResolveSelectionScope`, z progiem materializacji i cache'em uuidów) — cała mechanika opisana w [zasięgu zaznaczenia §2](./selection-scope.md#2-trzy-zasięgi-i-próg-materializacji). **Nie odtwarzaj tego ręcznie** — skopiuj `product.store.ts` i zmień typy (`XVM`, `SearchXRequest`, próg materializacji dobrany dla agregatu).
4. **Stan ładowania** (`signal<boolean>`) — dla `erp-filter` (spinner przycisku szukania).

Store strony jest jedynym miejscem, które zna regułę „lista czy filtr" (`scope`). Ani filtr, ani smart tabela, ani panele boczne nie podejmują tej decyzji same — czytają gotowy `scope`/`scopeKind` ze store'a.

Jeżeli page **nie ma** akcji masowych i zakładki służą tylko do podglądu/edycji **jednego** wybranego wiersza (master-detail, nie bulk) — store jest dużo prostszy, patrz wariant w §7. Nie buduj wtedy `ErpSelectionScope`, którego nikt nie skonsumuje.

---

## 5. Główna lista (`content`)

Jeden Smart Component w `page/tabs/` (jeśli są zakładki — wtedy to pierwsza zakładka, patrz §3) albo bezpośrednio w `page/` (jeśli zakładek nie ma), łączący:

```typescript
template: `
  <div class="h-full w-full p-2">
    <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
      <erp-action-toolbar [config]="actionToolbar" />
      <div class="flex-1 overflow-hidden">
        <erp-catalog-product-table
          stateKey="product-tab-main"
          [filters]="currentFilters()"
          (selectionChange)="onSelectionChange($event)"
          (loadingChange)="store.setLoading($event)"
          (sortsChange)="store.setSorts($event)"
          class="block h-full"
        />
      </div>
    </div>
  </div>
`
```

- **Bez własnego nagłówka strony (`<h1>`/tytuł+podtytuł) w `content`.** Referencyjny `product-tab.component.ts` (i cały przykład w §1) nie ma takiego nagłówka — nazwa strony żyje w routingu/menu (patrz [nowy moduł](./new-module.md)), nie jest powtarzana wewnątrz `content`. Dodanie `<h1>{{ X_KEYS.title | erpTranslate }}</h1>` + `<p>{{ X_KEYS.subtitle | erpTranslate }}</p>` na górze `content` zabiera miejsce filtrowi/tabeli i dubluje informację, którą użytkownik już widzi w tytule zakładki przeglądarki/breadcrumbie. Znalezione i usunięte w `users-content.component.ts`, `roles-content.component.ts`, `grant-audit-content.component.ts`, `permissions-catalog-list.component.ts` — wszystkie cztery dodały taki nagłówek niezależnie od siebie, mimo że żaden przykład referencyjny go nie ma.
- **Smart tabela** (`erp-catalog-product-table` w przykładzie) — komponent osobny, zbudowany wg [smart-tables.md](./smart-tables.md); page go tylko konsumuje, nie zna jego wewnętrznej logiki paginacji/fetchowania.
- **`selectionMode` smart tabeli jest jej własnym inputem** (`selectionMode = input<ErpSelectionMode>('multi')`, patrz [smart-tables.md §2](./smart-tables.md#2-anatomia)), **nigdy** wartością zaszytą na sztywno w `.setSelectionMode(...)` wewnątrz buildera tabeli — nawet gdy dany page używa jej tylko z jednym trybem (np. `'single'` w wariancie master-detail, §7). Zaszycie na sztywno nie boli, dopóki tabela ma jednego konsumenta, ale blokuje ponowne użycie tego samego komponentu w innym page z innym trybem zaznaczenia — a to jest właśnie cel wydzielenia jej jako osobnego Smart Component.
- **`erp-action-toolbar`** zawsze **nad** tabelą, wewnątrz `div` z `erpActionToolbarZone` + `[erpActionToolbarContext]="actionToolbar"` (włącza skróty klawiszowe i Mega Menu zakresu tej strefy) — nigdy pod tabelą, nigdy jako osobny obszar siatki.
- `actionToolbar` (`ErpActionToolbarBuilder`) rozdziela akcje na `addDefaultGroup` (zawsze dostępne — dodaj, eksport, odśwież) i `addSelectionGroup` (wymagają zaznaczenia — edycja masowa, zmiana statusu). Podłącz zawsze:
  ```typescript
  .setSelectionCount(this.selectionCount)              // erpSelectionScopeCount(store.scope())
  .setSelectionScope(this.store.scopeKind)              // bramkowanie akcji nad filtrem — patrz selection-scope.md §5
  .setOnClearSelection(() => { this.store.clearSelection(); this.productTable()?.clearSelection(); })
  ```
- **Zaznaczenie z tabeli trafia do store'a, nie zostaje lokalne**: `onSelectionChange(state) { this.store.setSelection(state); }` — to jedyna droga, którą zasięg dociera do zakładek w `rightPanel`.
- Modale akcji masowych otwierają się z `erpBuildBatchTargets(this.store.scope())` jako cel + `{ targetCount: this.selectionCount() }` jako metadane — nigdy ręcznym składaniem `targetUuids`/`targetFilter` (patrz [zasięg zaznaczenia §3](./selection-scope.md#3-cele-operacji-masowych--jeden-helper-zero-ręcznego-składania)).
- **Akcja dotycząca JEDNEGO konkretnego wiersza (odbierz rolę, usuń wpis, dezaktywuj...) jest akcją zaznaczenia w `erp-action-toolbar`, nie przyciskiem w komórce tabeli.** Ustaw `selectionMode: 'single'` (albo `'multi'`, jeśli akcja ma sens nad wieloma naraz), zbierz wybrany wiersz przez `.setOnSelectionChange(...)`, i dodaj akcję przez `addSelectionGroup(...)` — dokładnie ten sam wzorzec co przy zaznaczeniu wielokrotnym w tym paragrafie, tylko z `selectionMode: 'single'`. Dotyczy to również małych, lokalnych tabel `mode: 'client'` w zakładkach szczegółu (§7), nie tylko głównej listy. Komórka z własnym komponentem (`.setCell(Component)`) jest wyłącznie dla **wyświetlania** (badge, pasek postępu, format) — patrz [smart-tables.md §5](./smart-tables.md#5-warianty) — nigdy dla przycisku wywołującego mutację. Powód: przycisk w komórce nie korzysta z żadnej maszynerii toolbara (bramkowanie po uprawnieniach przez `.setHidden(...)`, przypięte akcje, skróty klawiszowe, Mega Menu) i psuje spójność z resztą aplikacji, gdzie każda mutacja idzie przez toolbar. Znalezione i poprawione w `user-roles-tab.component.ts` (był osobny `IdentityRowRemoveCellComponent` w kolumnie zamiast `addSelectionGroup`) — ten sam błąd powtarza się jeszcze w `user-permissions-tab.component.ts` i `roles/tabs/role-members-tab.component.ts`.
- **Dane w zakładce/panelu — nawet proste, tylko-do-odczytu — renderuje `erp-table` (`mode: 'client'` dla danych już w pamięci), nie ręcznie pisany `@for` z divami/chipami.** Pokusa napisania własnego layoutu pojawia się przy prostych listach (np. płaski zbiór kodów pogrupowany po module), ale `erp-table` daje za darmo sortowanie, resize kolumn, `stateKey`, wirtualizację i spójny `emptyMessage` — własny `@for` tego nie ma i za każdym razem trzeba to pisać ręcznie od nowa. Znalezione i poprawione w `user-effective-permissions-tab.component.ts` (lista `<div>`/`<span class="chip">` zamiast `erp-table` z kolumnami Moduł/Uprawnienie).

---

## 6. Panel boczny zależny od zaznaczenia (kolejne zakładki, `rightPanel`)

Każda zakładka poza pierwszą renderuje się w `rightPanel` i **musi** wspierać wielokrotne zaznaczenie z głównej tabeli — nigdy nie zakłada, że zaznaczono dokładnie jeden wiersz. Trzy elementy, zawsze razem:

### 6.1 Store zakładki dziedziczy po wspólnej bazie zasięgu strony

Jedna abstrakcyjna klasa na page (`page/tabs/AGGREGATE-scope-tab.store.ts`, wzór: `product-scope-tab.store.ts`) implementuje raz całą mechanikę „Zaznacz wszystko" opisaną w [zasięgu zaznaczenia §4](./selection-scope.md#4-panel-zależny-od-zaznaczenia-w-trybie-query): próbkę N pierwszych pozycji w trybie `query`, blokadę granularnego wyboru, modele widoku po UUID z orkiestratora (aktualizacje SignalR za darmo), czyszczenie podzaznaczenia przy zmianie zbioru. Store konkretnej zakładki tylko dziedziczy i dokłada to, co specyficzne dla jej wierszy podrzędnych:

```typescript
@Injectable() // rejestrowany na poziomie komponentu zakładki, nie page
export class MultimediaTabStore extends ProductScopeTabStore<MultimediaRow> {
  public readonly selectedMultimedia = computed(() => new Set(this.selectedChildren().map(r => r.uuid)));
  constructor() { super(MULTIMEDIA_PREVIEW_PRODUCT_LIMIT); }
}
```

**Nie odtwarzaj tej mechaniki w nowej zakładce** — kopiowanie progów/próbek/momentów czyszczenia rozjeżdża się przy pierwszej zmianie (patrz [częste błędy](./selection-scope.md#7-częste-błędy)).

### 6.2 Komponent zakładki: stany zasięgu + `erp-table`, nie smart tabela

```typescript
@Component({
  selector: 'erp-multimedia-tab',
  imports: [ErpTableComponent, ErpActionToolbarComponent, ErpActionToolbarZoneDirective,
            ErpActionToolbarContextDirective, ErpEmptyStateComponent, ErpSelectionScopeBannerComponent],
  providers: [MultimediaTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (_scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else if (_resolving()) {
        <erp-empty-state [config]="resolvingConfig" />
      } @else {
        <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="toolbarConfig">
          <erp-action-toolbar [config]="toolbarConfig" />
          <erp-selection-scope-banner [config]="scopeBannerConfig" />
          <div class="flex-1 overflow-hidden">
            <erp-table class="block h-full w-full" [config]="tableConfig()" />
          </div>
        </div>
      }
    </div>
  `,
})
```

Kluczowa różnica względem głównej listy: panel buduje tabelę wprost przez `ErpTableBuilder` w komponencie zakładki (`.setMode('client')`, dane już wczytane przez orkiestrator zamiast płynące z osobnego zapytania paginowanego) — **nie owija jej we własny smart-table component**. Panel nie ma własnej paginacji API: pokazuje albo komplet zaznaczonych rodziców, albo próbkę (`PRODUCT_SCOPE_PREVIEW_LIMIT`), więc `mode: 'client'` + `setGroupedRows` (grupowanie wierszy podrzędnych pod rodzicem) wystarcza.

Trzy stany, zawsze w tej kolejności:

| Stan | Warunek | Co pokazać |
|---|---|---|
| Brak zaznaczenia | `scopeKind() === 'none'` | `erp-empty-state` z ikoną „kliknij, by zaznaczyć" |
| Materializacja w toku | `resolving()` (zasięg `explicit` z `loading: true`) | `erp-empty-state` z ikoną ładowania — **nie** pusty ekran i **nie** baner trybu filtra |
| Gotowe | w przeciwnym razie | toolbar + baner zasięgu + tabela |

`erp-selection-scope-banner` (`ErpSelectionScopeBannerBuilder`) renderuje się zawsze w stanie „gotowe" — sam rozstrzyga, czy pokazać ostrzeżenie o próbce, spokojne potwierdzenie po materializacji, czy nic. Nie warunkuj jego obecności ręcznie.

Konfiguracja tabeli jest `computed`, bo tryb zaznaczenia zależy od zasięgu:
```typescript
.setSelectionMode(this.tabStore.canSelectChildren() ? 'multi' : 'none')
```

### 6.3 Toolbar panelu — bramkowany zasięgiem

```typescript
ErpActionToolbarBuilder.create(b => b
  .setSelectionCount(this.tabStore.selectedChildrenCount)
  .setSelectionScope(this.tabStore.scopeKind)             // zasięg RODZICÓW (produktów), nie dzieci (plików)
  .setOnClearSelection(() => this.tabStore.clearChildSelection())
  .addSelectionGroup(g => g.addAction(a => a
    .setScopes(['explicit'])                              // wymaga WSKAZANYCH rodziców, nie filtra
    .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
    .setFn(() => this.onDeleteSelectedMedia())
  ))
);
```

Akcje wyrażalne nad całym zbiorem (dodaj, usuń wszystkie, ustaw wartość) zostają dostępne w każdym zasięgu; akcje wymagające tożsamości konkretnych pozycji (usuń zaznaczone pliki, pobierz wskazane) dostają `.setScopes(['explicit'])` + `.setUnavailableHint(...)` — blokada z podpowiedzią, nigdy ukrywanie przycisku (patrz [zasięg zaznaczenia §5](./selection-scope.md#5-bramkowanie-akcji-toolbara)).

---

## 7. Wariant bez akcji masowych: pojedynczy wybór (master-detail)

Gdy page nie potrzebuje zaznaczenia wielokrotnego ani operacji masowych — tylko podgląd/edycję jednego wybranego wiersza (np. `/identity/users`: klik w użytkownika pokazuje jego role/uprawnienia) — nie buduj `ErpSelectionScope`, którego nic nie skonsumuje. Store strony trzyma zwykły `selectedUuid = signal<string | null>(null)`:

```typescript
@Injectable()
export class UsersStore {
  public readonly filters = signal<Partial<SearchUserAccountRequest>>({});
  public readonly loading = signal<boolean>(false);
  public readonly selectedUuid = signal<string | null>(null);

  public selectUser(uuid: string | null): void { this.selectedUuid.set(uuid); }
}
```

Reszta szkieletu (grid, filtr, `ErpTabsComponent` renderowany dwa razy, `rightPanel` chowany warunkiem) jest **identyczna** jak w §1–3, **łącznie z zasadą §3 pkt 1** — pierwszy `addTab(...)` (id `'list'` w przykładzie) **nie dostaje** `component`, dokładnie jak `'products'` w `ProductComponent`. Smart tabela w `content` ma `selectionMode` `'single'` zamiast `'multi'` (patrz [smart-tables.md §5](./smart-tables.md#5-warianty)) i emituje `selectionChange` jako `string | null`, nie `ErpSelectionState`. Zakładki w `rightPanel` nie dziedziczą po żadnym `XScopeTabStore` — czytają wprost `selectedUuid` ze store'a strony i renderują dane jednego wiersza.

**Jedyna różnica względem §3: `collapsed` ma dwa warunki połączone `||`, nie jeden.** W §3 `rightPanel` chowa się wyłącznie wtedy, gdy aktywna jest zakładka-lista. Tu chowa się także wtedy, gdy nic nie jest zaznaczone — bo w tym wariancie treść `rightPanel` zależy od wybranego wiersza, nie tylko od tego, którą zakładkę otworzył użytkownik:

```typescript
protected readonly activeTabId = signal<string | null>(null);

protected readonly tabsConfig = ErpTabsBuilder.create(b => b
  .setLayout('horizontal')
  .withSharedState(this.activeTabId)             // wymagane zawsze, gdy ErpTabsComponent renderuje się dwa razy — patrz §10
  .addTab(USERS_KEYS.detail.tabs.list, 'list', { icon: '@tui.list' })   // bez `component` — jak 'products' w §3
  .addTab(USERS_KEYS.detail.tabs.roles, 'roles', { component: UserRolesTabComponent, icon: '@tui.shield' })
  // ... kolejne zakładki szczegółu
  .setInitialValue('list')
  .setOnTabChange(noop)
);

// w rightPanel:
collapsed: computed(() => this.activeTabId() === 'list' || !this._store.selectedUuid()),
```

**Zaznaczenie wiersza, gdy zakładka-lista jest aktywna, musi ją przełączyć na pierwszą zakładkę szczegółu.** Bez tego wybranie wiersza na zakładce `'list'` nie miałoby żadnego widocznego efektu — `collapsed` zostałby `true` przez sam `activeTabId() === 'list'`, mimo że `selectedUuid()` przestał być pusty. To osobny `effect()` w konstruktorze page, bo `tabsConfig`/`activeTabId` i `store.selectedUuid()` żyją w dwóch różnych miejscach:

```typescript
public constructor() {
  effect(() => {
    if (this._store.selectedUuid() && this.activeTabId() === 'list') {
      this.activeTabId.set('roles');   // pierwsza zakładka szczegółu, nie 'list'
    }
  });
}
```

Wybór wariantu: jeśli page ma **jakąkolwiek** akcję masową (edycja/usunięcie/eksport wielu pozycji naraz) — wariant z §1–6 (`ErpSelectionScope`, `selectionMode: 'multi'`). Jeśli page tylko pokazuje szczegóły jednej wybranej pozycji — ten wariant.

---

## 8. Struktura katalogów

```
libs/modules/MODULE_NAME/feature/src/lib/AGGREGATE/
├── page/
│   ├── AGGREGATE.component.ts          # szkielet erp-grid-layout (§1)
│   ├── AGGREGATE.store.ts              # store strony — filtry/sortowanie/zaznaczenie/zasięg (§4)
│   ├── filters/
│   │   └── AGGREGATE-filter.component.ts
│   └── tabs/                            # tylko jeśli są zakładki (§3)
│       ├── AGGREGATE-tab.component.ts             # pierwsza zakładka — lista (§5)
│       ├── AGGREGATE-scope-tab.store.ts           # baza dla paneli bocznych (§6.1)
│       └── CHILD_NAME/                            # jedna zakładka boczna = jeden podkatalog
│           ├── CHILD_NAME-tab.component.ts        # §6.2
│           ├── CHILD_NAME-tab.store.ts            # dziedziczy po AGGREGATE-scope-tab.store.ts
│           └── CHILD_NAME-row.model.ts             # kształt wiersza tabeli panelu, jeśli spłaszczony
├── components/
│   └── MODULE-AGGREGATE-table/
│       └── MODULE-AGGREGATE-table.component.ts    # smart tabela główna (§5, patrz smart-tables.md)
├── modal/                               # modale akcji masowych, jeśli są
└── translation/
```

---

## 9. Przepis: nowy page dla agregatu

1. **Sprawdź, czy orkiestrator agregatu istnieje** (`searchAsync`, `getViewModel()`/`getSignalViewModel()`) — jeśli nie, najpierw [orkiestrator](./orchestrators.md).
2. **Zbuduj smart tabelę** dla agregatu wg [smart-tables.md](./smart-tables.md), z `sortsChange`/`.setFilters(...)`, jeśli page będzie miał zasięg zaznaczenia (§9.9 tamtego dokumentu).
3. **Store strony** — skopiuj `product.store.ts` (pełny zasięg, §4) albo `users.store.ts` (pojedynczy wybór, §7) — zależnie od tego, czy będą akcje masowe.
4. **Filtr** — `ErpFilterBuilder` w `page/filters/`, `setOnSearch` woła store (§2).
5. **Zdecyduj o zakładkach** (§3). Brak akcji specyficznych dla podzbiorów danych → bez zakładek, `content` renderuje wrapper toolbar+tabela wprost. W przeciwnym razie: `ErpTabsBuilder` w komponencie page, pierwszy `addTab` bez `component`, kolejne z `component` wskazującym panel boczny.
6. **Pierwsza zakładka / `content`** — wrapper z `erp-action-toolbar` nad smart tabelą, `onSelectionChange` woła `store.setSelection(...)` (§5).
7. **Każdy panel boczny**: store dziedziczący po `AGGREGATE-scope-tab.store.ts` (§6.1) + komponent z trzema stanami zasięgu, `erp-table` w trybie `client`, `erp-selection-scope-banner`, toolbar bramkowany `.setScopes(['explicit'])` tam, gdzie akcja wymaga wskazanych pozycji (§6.2–6.3).
8. **Szkielet siatki** w `AGGREGATE.component.ts` — `ErpGridLayoutBuilder`, `setLayoutId` unikalny w aplikacji, `ErpTabsComponent` renderowany dwa razy (`renderMode: 'tabs'` / `'content'`), `collapsed` na `rightPanel` warunkiem po aktywnej pierwszej zakładce / braku zaznaczenia (§1, §3).
9. **Tłumaczenia** — wyłącznie klucze z registry modułu (`AGGREGATE_KEYS...`), zero stringów na sztywno w szablonach i etykietach toolbara/zakładek — patrz [tłumaczenia](./translations.md).
10. **Rejestracja w routingu** modułu (`contract`) i w menu — patrz [nowy moduł §…](./new-module.md), jeśli to pierwszy page modułu.

---

## 10. Częste błędy

- **Zakładki dla page, który ma tylko tabelę i akcje** — niepotrzebny `rightPanel`, `ErpTabsBuilder` i pusty narzut. Bez zakładek, jeśli nie trzeba dzielić widoku.
- **Pierwsza zakładka z `component` ustawionym w `addTab`** — wtedy `rightPanel` próbuje wyrenderować listę drugi raz obok tej w `content`. Pierwsza zakładka nie ma `component`; jej treścią jest obszar `content`.
- **Panel boczny czytający `store.selection().selectedItems` wprost** zamiast `store.scope()` — przy „Zaznacz wszystko" to pole jest puste; panel pokaże pusty ekran mimo tysięcy zaznaczonych pozycji (patrz [zasięg zaznaczenia §7](./selection-scope.md#7-częste-błędy)).
- **Panel boczny jako smart tabela z własnym `searchAsync`** zamiast `erp-table` w trybie `client` karmionego z `tabStore.products`/orkiestratora — panel pokazuje dowód zasięgu, nie prowadzi własnej paginacji API.
- **Nowa zakładka odtwarzająca mechanikę zasięgu** zamiast dziedziczenia po `AGGREGATE-scope-tab.store.ts` — progi/próbki/czyszczenie podzaznaczenia rozjadą się przy pierwszej zmianie.
- **`erp-action-toolbar` poza `erpActionToolbarZone`** albo bez `[erpActionToolbarContext]` — skróty klawiszowe i Mega Menu tej strefy nie działają.
- **Budowanie `ErpSelectionScope` dla page z pojedynczym wyborem** (master-detail bez akcji masowych) — niepotrzebna złożoność; wystarczy `selectedUuid` jak w §7.
- **Różne `setLayoutId` między środowiskami/kopiami tego samego page** albo kolizja z istniejącym — psuje zapisane preferencje szerokości paneli innego page.
- **`selectionMode` zaszyty na sztywno w `.setSelectionMode(...)` smart tabeli** zamiast wystawiony jako `input()` (patrz §5, [smart-tables.md §2](./smart-tables.md#2-anatomia)) — działa dopóki tabela ma jednego konsumenta, ale blokuje jej ponowne użycie w innym page z innym trybem zaznaczenia. Znaleziony w `identity-users-table.component.ts`.
- **Brak `.withSharedState(this.activeTabId)` w `tabsConfig`, gdy `ErpTabsComponent` renderuje się dwa razy** (`renderMode: 'tabs'` + `renderMode: 'content'`) — bez współdzielonego stanu obie instancje trzymają osobny, niezależny stan aktywnej zakładki; kliknięcie nagłówka w obszarze `tabs` nie zmienia niczego w `rightPanel`. Dotyczy **każdego** wariantu z zakładkami, nie tylko §3. Znaleziony w `users.component.ts` i `roles.component.ts`.
- **Pominięcie pierwszej zakładki-listy (bez `component`) w wariancie master-detail (§7)** — to nie jest coś, co odróżnia ten wariant od §3; zasada „pierwsza zakładka to lista" obowiązuje tu tak samo. Bez niej użytkownik nie ma sposobu, żeby ręcznie schować `rightPanel` i zobaczyć pełną listę, mając nadal zaznaczony wiersz. Znaleziony w `users.component.ts` i `roles.component.ts` — brakowało zarówno tej zakładki, jak i drugiego warunku w `collapsed` (`activeTabId() === 'list' || ...`).
- **Przycisk mutujący w komórce tabeli** (np. własny komponent komórki z ikoną kosza wołający komendę) **zamiast akcji zaznaczenia w `erp-action-toolbar`** (§5) — omija bramkowanie po uprawnieniach przez toolbar, przypięte akcje i skróty klawiszowe. Znaleziony w `user-roles-tab.component.ts` (`IdentityRowRemoveCellComponent`); ten sam wzorzec żyje jeszcze w `user-permissions-tab.component.ts` i `roles/tabs/role-members-tab.component.ts` — nie kopiuj z nich tej części.
- **Ręcznie pisany `@for` z divami/chipami zamiast `erp-table`** dla danych w zakładce/panelu, nawet prostych i tylko-do-odczytu (§5) — traci sortowanie, resize, `stateKey`, wirtualizację i spójny `emptyMessage` za darmo dostępne w `erp-table`. Znaleziony w `user-effective-permissions-tab.component.ts`.
- **Nagłówek `<h1>`/tytuł+podtytuł na górze `content`** (§5) — żaden przykład referencyjny go nie ma, nazwa strony już żyje w routingu/menu. Znaleziony niezależnie w czterech różnych `*-content.component.ts` tego samego modułu (`users`, `roles`, `grant-audit`, `permissions`) — silny sygnał, że trzeba było to spisać zamiast liczyć, że kolejny page „zobaczy" brak nagłówka w przykładzie.

---

## 11. Zobacz też

- [Smart tabele](./smart-tables.md) — anatomia komponentu tabeli głównej listy
- [Zasięg zaznaczenia i akcje masowe](./selection-scope.md) — `ErpSelectionScope`, materializacja, cele operacji masowych, bramkowanie toolbara
- [Orkiestratory](./orchestrators.md) — `searchAsync`, `getViewModel()`/`getSignalViewModel()`, którymi karmią się tabela główna i panele
- [Atomy UI — Single Config Builder](./atoms.md) — wzorzec, którym zbudowane są `erp-grid-layout`, `erp-tabs`, `erp-table`, `erp-filter`, `erp-action-toolbar`
- [Modale](./modals.md) — modale akcji masowych otwierane z toolbara
- [Tłumaczenia](./translations.md) — klucze dla etykiet filtrów, kolumn, zakładek, akcji toolbara
