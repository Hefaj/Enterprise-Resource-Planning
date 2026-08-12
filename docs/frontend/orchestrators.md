# Orkiestratory (warstwa `data-access`)

Orkiestrator to serwis Angularowy (singleton, `providedIn: 'root'`), który jest właścicielem stanu dla jednego agregatu domenowego (np. `Product`, `Category`, `Warranty`). Odpowiada za:

- pobieranie danych z API (pojedynczo i w paczkach, z deduplikacją),
- trzymanie ich w pamięci podręcznej (`IdentityMapStore`, LRU),
- nasłuchiwanie aktualizacji z SignalR i odświeżanie cache w czasie rzeczywistym,
- mapowanie surowego `DTO` (to, co przyjeżdża z API) na bogaty `ViewModel` (to, czego używa UI),
- wystawianie reaktywnego API opartego o Signals (`getViewModel()`, `getSignalViewModel()`, `getOne()`).

Bazowa implementacja: [`base-orchestrator.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/base-orchestrator.ts). Każdy orkiestrator dziedziczy z `BaseOrchestrator<TDto, TViewModel, TFilters, TLoadOptions>`.

Przykłady referencyjne w tym dokumencie: `CatalogProductOrchestrator` ([`catalog-product.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/catalog-product.orchestrator.ts)), który wzbogaca produkt o kategorie, model, multimedia i gwarancje, oraz `CatalogCategoryOrchestrator` ([`catalog-category.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/category/catalog-category.orchestrator.ts)) — sekcja 5, wzorzec dla danych hierarchicznych.

Orkiestrator żyje w warstwie `data-access` — zobacz [architektura frontendu](./architecture.md) dla szerszego kontekstu (5 warstw modułu, Native Federation, granice ESLint).

---

## 1. Szkielet orkiestratora

```typescript
@Injectable({ providedIn: 'root' })
export class CatalogProductOrchestrator extends BaseOrchestrator<
  ProductDto,          // TDto — surowy typ z API (NSwag)
  ProductVM,           // TViewModel — wzbogacony model dla UI
  SearchProductRequest,// TFilters — parametry wyszukiwania
  CatalogProductLoadOptions // TLoadOptions — flagi eager-loadingu
> {
  private readonly _api = inject(CatalogClient);

  protected override readonly signature = 'catalog.product';

  protected override readonly orchestratorConfig = {
    signalrSignature: 'catalog.product',
    maxCacheSize: 1000,
    maxChunkSize: 100,
    bufferTimeMs: 50,
  };

  protected override fetchByUuids(uuids: string[]): Observable<ProductDto[]> {
    return this._api.getProduct({ uuids });
  }

  protected override searchByFilters(filters: SearchProductRequest): Observable<SearchResponse> {
    return this._api.searchProduct(filters);
  }

  protected override mapToViewModel(dto: ProductDto, resolvedDeps: ResolvedDeps): ProductVM {
    // patrz sekcja 3
  }
}
```

Cztery elementy są obowiązkowe:

| Element | Rola |
|---|---|
| `signature` | unikalny string identyfikujący agregat w zdarzeniach SignalR, np. `'catalog.product'` |
| `orchestratorConfig` | konfiguracja: `signalrSignature`, `maxCacheSize` (LRU), `maxChunkSize`/`bufferTimeMs` (batching zapytań) |
| `fetchByUuids(uuids)` | pobranie DTO z API po UUID (klient NSwag) |
| `searchByFilters(filters)` | wyszukiwanie — zwraca same UUID (`SearchResponse`), nie pełne obiekty |
| `mapToViewModel(dto, resolvedDeps)` | **czysta** funkcja DTO + rozwiązane zależności → ViewModel |

> Jeśli agregat nie ma żadnych powiązań do dociągnięcia, nie twórz dedykowanego `XLoadOptions` — użyj wprost `LoadOptions` z `@erp/shared/data-access`.

---

## 2. ViewModel — co to jest i po co

`ViewModel` (`XxxVM`) to typ, którym operuje UI. Zawsze **rozszerza** DTO (`extends XxxDto`) i dodaje pola, których w surowej odpowiedzi z API nie ma, bo wymagają połączenia danych z kilku agregatów:

```typescript
export interface ProductVM extends ProductDto {
  readonly categories: CategoryVM[];   // rozwiązane z categoryUuids
  readonly model: ModelVM | null;      // rozwiązany z modelUuid
  readonly multimedia: MultimediaVM[]; // rozwiązane z multimediaUuids
  readonly warranties: ProductWarrantyVM[]; // patrz sekcja 4 — przypadek szczególny
}
```

Zasada dot. lintera: jeśli `ViewModel` **nie dodaje żadnych pól** względem `Dto`, zdefiniuj go jako alias typu, nie pusty interfejs:

```typescript
// ✅
export type WarrantyVM = WarrantyDto;

// ❌ — @typescript-eslint/no-empty-object-type
export interface WarrantyVM extends WarrantyDto {}
```

### Skąd biorą się dane do wzbogacenia

`mapToViewModel` dostaje `resolvedDeps` — worek już rozwiązanych zależności. Orkiestrator sam decyduje, jak je zbudować, nadpisując dwie metody:

- **`resolveEagerDependencies(uuids, options)`** — wywoływana raz, asynchronicznie, przy `loadAsync(uuids, options)`. Zbiera UUID-y powiązanych agregatów z załadowanych DTO i woła `loadAsync(...)` na sąsiednich orkiestratorach, żeby dane trafiły do ich cache.
- **`_resolveCurrentDeps(dto)`** — wywoływana **synchronicznie**, wewnątrz `computed()`, za każdym razem gdy trzeba zmapować DTO na VM (czyli w `getViewModel()`, `getSignalViewModel()`, `getOne()`). Czyta wyłącznie to, co już jest w cache sąsiednich orkiestratorów — nie robi żadnych requestów.

```typescript
protected override async resolveEagerDependencies(
  uuids: string[],
  options: CatalogProductLoadOptions,
): Promise<void> {
  const categoryUuids = new Set<string>();
  for (const uuid of uuids) {
    const dto = this.identityMap.peek(uuid);
    if (options.includeCategories && dto?.categoryUuids) {
      dto.categoryUuids.forEach(u => categoryUuids.add(u));
    }
  }
  if (categoryUuids.size > 0) {
    await this._categorySiblingOrchestrator.loadAsync([...categoryUuids]);
  }
}

protected override _resolveCurrentDeps(dto: ProductDto): ProductResolvedDeps {
  const categories = dto.categoryUuids
    ? this._categorySiblingOrchestrator.resolveCategoryVMs(dto.categoryUuids)
    : [];
  return { categories, /* ... */ };
}
```

### Cykliczne zależności między orkiestratorami

`Product` potrzebuje `Category`, ale `Category` nie powinna (i zwykle nie musi) znać `Product` w konstruktorze — DI Angulara nie lubi takich cykli. Rozwiązanie: **leniwe wstrzykiwanie** przez `Injector`, gettera zamiast pola:

```typescript
private readonly _injector = inject(Injector);
private _categoryOrchestrator: CatalogCategoryOrchestrator | null = null;

private get _categorySiblingOrchestrator(): CatalogCategoryOrchestrator {
  if (!this._categoryOrchestrator) {
    this._categoryOrchestrator = this._injector.get(CatalogCategoryOrchestrator);
  }
  return this._categoryOrchestrator;
}
```

---

## 3. Reaktywne API dla komponentów

| Metoda | Zwraca | Kiedy używać |
|---|---|---|
| `loadAsync(uuids, options?)` | `Promise<void>` | punkt wejścia do ładowania danych (+ eager deps) |
| `searchAsync(filters, opts?)` | `Promise<SharedSearchResponse>` | wyszukiwanie, opcjonalnie z auto-loadem wyników |
| `getViewModel()` | `Signal<Map<uuid, VM>>` | listy, gdzie i tak konsumujesz całą mapę naraz |
| `getSignalViewModel()` | `Map<uuid, Signal<VM>>` | wiersze tabeli — zmiana jednego rekordu nie przelicza całej listy |
| `getOne(uuid)` | `Signal<VM \| undefined>` | pojedynczy element, np. komórka rozwiązująca się niezależnie |

Wszystkie te metody wołają `mapToViewModel(dto, this._resolveCurrentDeps(dto))` pod spodem — dlatego `_resolveCurrentDeps` musi być **synchroniczne i tanie** (tylko odczyt z cache).

---

## 4. Jak wzbogacać, żeby nie tracić danych — zasada nadpisywania pól

To jest najważniejsza (i najczęściej łamana) zasada przy projektowaniu `XxxVM`.

### Dwa "bezpieczne" przypadki (różne nazwy pól)

Kiedy DTO trzyma tylko **referencję** (pojedynczy UUID albo listę samych UUID-ów), a `ViewModel` dodaje pole o **innej nazwie** z pełnym obiektem — nic nigdy nie ginie, bo nie ma kolizji nazw:

```typescript
// DTO: modelUuid: string | null
// VM:  model: ModelVM | null        ← inna nazwa, brak konfliktu

// DTO: categoryUuids: string[]
// VM:  categories: CategoryVM[]     ← inna nazwa, brak konfliktu
```

### Przypadek problematyczny: DTO już ma listę obiektów pod tą samą nazwą

Czasem DTO trzyma nie same UUID-y, tylko listę **obiektów przypisania** (np. `warranties: ProductWarrantyDto[]`, gdzie każdy element to `{ warrantyUuid, durationMonths }` — dane specyficzne dla tego konkretnego przypisania produkt-gwarancja). Naturalna nazwa dla wzbogaconej wersji to... też `warranties`. Tu pojawia się pokusa, żeby:

1. nadpisać `warranties` w `ViewModel` zupełnie innym typem (np. listą katalogowych `WarrantyVM`, dociąganą leniwie), i
2. dorzucić **osobne, sztuczne pole** (np. `warrantyAssignments`) będące ręczną kopią oryginalnego `dto.warranties`, żeby nie stracić dostępu do surowych danych przypisania.

**Nie rób tego.** Efekt uboczny: dwa pola noszące to samo znaczeniowo, ręczna synchronizacja, i ryzyko, że ktoś kiedyś przeoczy, że `warranties` na `VM` to *nie* to samo co `warranties` na `Dto`.

### Poprawny wzorzec: wzbogacaj element, nie tablicę

Zamiast nadpisywać całe pole innym, niezwiązanym typem — rozszerz **typ elementu** listy o DTO, z którego pochodzi, i dodaj do niego pole wzbogacające. Wtedy nadpisanie pola w `ViewModel` jest **bezpiecznym podtypem** (kowariancja tablic w TS), a nie utratą danych: każdy element VM ma zagwarantowane wszystko, co miał w DTO, plus coś dodatkowo.

**Gdzie zdefiniować `ItemVM`:** w pliku view-modelu agregatu, który jest **właścicielem kontraktu DTO** elementu — czyli tego, którego endpoint zwraca tę listę — a nie agregatu, z którego dociągane są dane wzbogacające. `ProductWarrantyDto` to kształt `ProductDto.warranties[]`, przychodzi z `getProduct` — to kontrakt Produktu. Dlatego `ProductWarrantyVM` mieszka w `product.view-model.ts` i stamtąd importuje `WarrantyVM` (agregat, z którego dociągane są dane), a nie odwrotnie — dokładnie tak, jak `product.view-model.ts` importuje `CategoryVM`/`ModelVM` z ich własnych plików:

```typescript
// product.view-model.ts
import { ProductDto, ProductWarrantyDto } from '../../api-client';
import { WarrantyVM } from '../warranty/warranty.view-model';

export interface ProductWarrantyVM extends ProductWarrantyDto {
  //                     ^^^^^^^^^^^^^^^^^^ rozszerzamy DTO PRZYPISANIA (kontrakt Produktu),
  //                                        nie katalogowe WarrantyDto (kontrakt Warranty)
  readonly productUuid: string;         // back-reference do rodzica — patrz niżej
  readonly warranty: WarrantyVM | null; // wzbogacenie — null, dopóki katalogowa gwarancja nie doładowana
}

export interface ProductVM extends ProductDto {
  readonly warranties: ProductWarrantyVM[];
  // ProductWarrantyVM extends ProductWarrantyDto ⇒ ProductWarrantyVM[] jest bezpiecznym
  // nadpisaniem ProductDto['warranties'] (ProductWarrantyDto[]) — zero utraty danych.
}
```

**Kto robi enrichment — orkiestrator agregatu wzbogacającego dostaje tylko UUID, nigdy typu drugiej strony.** `CatalogWarrantyOrchestrator` zna wyłącznie swój własny kontrakt — wystawia `resolveWarrantyVM(uuid): WarrantyVM | null`, dokładnie tak samo jak `CatalogModelOrchestrator.resolveModelVM(uuid): ModelVM | null`. Nie importuje `ProductWarrantyDto` ani `ProductWarrantyVM` — nie musi wiedzieć, że coś takiego jak "przypisanie do produktu" w ogóle istnieje:

```typescript
// catalog-warranty.orchestrator.ts — zna tylko WarrantyDto/WarrantyVM, nic więcej
public resolveWarrantyVM(uuid: string): WarrantyVM | null {
  const dto = this.identityMap.peek(uuid);
  return dto ? this.mapToViewModel(dto) : null;
}
```

Samo łączenie przypisania z katalogową gwarancją (mapowanie 1:1 po `dto.warranties`, bez filtrowania nierozwiązanych — stąd stabilna liczba/kolejność od razu) robi `CatalogProductOrchestrator`, bo to on zna oba typy (`ProductWarrantyDto` to jego kontrakt, a `WarrantyVM` dostaje z cudzego, publicznego API):

```typescript
// catalog-product.orchestrator.ts, w _resolveCurrentDeps(dto)
const warranties: ProductWarrantyVM[] = (dto.warranties ?? []).map(assignment => ({
  ...assignment,                                                        // warrantyUuid, durationMonths — od razu
  productUuid: dto.uuid,                                                // back-reference do rodzica, patrz niżej
  warranty: this._warrantySiblingOrchestrator.resolveWarrantyVM(assignment.warrantyUuid), // dociągane stopniowo
}));
```

Efekt: **żaden orkiestrator nie importuje typów DTO/VM należących do innego agregatu** — każdy zna tylko swój własny kontrakt (uuid wchodzi, własny VM wychodzi) i typy DTO, które faktycznie zwraca jego własny endpoint. Konsument w komponencie od razu ma stabilną liczbę wierszy (`product.warranties.length` nie zmienia się w miarę doładowywania), a szczegóły katalogowe (`.warranty?.name`, `.warranty?.description`) pojawiają się, gdy tylko są dostępne — bez osobnego, ręcznie synchronizowanego pola.

**Efekt uboczny na plus:** DTO przypisania (`ProductWarrantyDto.durationMonths` — okres dla *tego* produktu) i katalogowe DTO (`WarrantyDto.durationMonths` — okres standardowy) mają tę samą nazwę pola, ale różne znaczenie. Zagnieżdżenie (`warranty.durationMonths` vs `durationMonths` na poziomie przypisania) eliminuje kolizję bez potrzeby sztucznego przemianowywania jednego z nich (np. na `productDurationMonths`).

### Back-reference na `ItemVM` zamiast adaptera w `feature`

`ProductWarrantyVM` wyżej ma pole `productUuid`, którego nie ma na `ProductWarrantyDto` — to nie jest dane z API, tylko UUID rodzica, dopisany ręcznie w `_resolveCurrentDeps` (`productUuid: dto.uuid`). Po co, skoro `ProductVM.warranties` już mieszka wewnątrz `ProductVM`, który ma swoje `uuid`?

Bo UI czasem musi **spłaszczyć** `ItemVM[]` z wielu rodziców w jedną wspólną listę — np. tabela gwarancji, gdy użytkownik zaznaczy kilka produktów naraz: wiersze wszystkich produktów lądują w jednej płaskiej liście (grupowanej po produkcie), a każdy wiersz potrzebuje unikalnego identyfikatora (`productUuid:warrantyUuid`) i klucza grupowania (`productUuid`). Poza kontekstem pojedynczego `ProductVM` ta informacja się gubi — element sam w sobie nie wie, do którego produktu należy.

Naturalną (ale złą) reakcją jest zbudowanie w `feature` osobnego, lekkiego modelu-adaptera tylko na potrzeby tej jednej tabeli (np. `WarrantyRow { productUuid; warrantyUuid; productDurationMonths }`), ręcznie mapowanego z `ProductWarrantyVM`. To dokłada drugi typ, który trzeba synchronizować z `ItemVM` (dokładnie ten sam problem, co "zduplikowane pole" wyżej — tylko przeniesiony do warstwy `feature`), plus ręczne mapowanie przy każdym przeliczeniu.

**Zamiast tego dodaj `productUuid` wprost do `ItemVM`**, w tym samym miejscu w `_resolveCurrentDeps`, gdzie już wzbogacasz element o inne pola. To tani, ogólnie użyteczny back-reference — nie tylko dla jednej tabeli w jednym komponencie, tylko dla każdego przyszłego miejsca, które będzie chciało skonsumować element `warranties` poza kontekstem `ProductVM`. Konsument w `feature` wtedy nie mapuje nic — po prostu spłaszcza:

```typescript
// warranty-tab.component.ts — bez pośredniego typu, bez ręcznego mapowania
protected readonly _rows = computed<ProductWarrantyVM[]>(() =>
  this._selectedProducts().flatMap(product => product.warranties)
);
```

`rowId` (`${productUuid}:${warrantyUuid}`) i klucz grupowania (`productUuid`) czyta się wtedy wprost z elementu, a `WarrantyInfoCellComponent` (komórka tabeli) przyjmuje `ProductWarrantyVM` zamiast dedykowanego typu wiersza.

### Checklista przy dodawaniu wzbogaconego pola do `XxxVM`

1. Czy DTO trzyma **sam UUID / listę UUID-ów**? → dodaj pole o **innej nazwie** z pełnym obiektem (`modelUuid` → `model`, `categoryUuids` → `categories`). Prosty przypadek, nic więcej nie trzeba robić.
2. Czy DTO trzyma **listę obiektów przypisania** (a nie gołych UUID-ów) i naturalna nazwa wzbogaconej wersji koliduje z nazwą pola w DTO? → **nie** twórz osobnego, zduplikowanego pola. Zdefiniuj `ItemVM extends ItemDto` z dodatkowym polem-referencją (`| null` dopóki nierozwiązane) i nadpisz pole w `XxxVM` tym samym podtypem.
3. `ItemVM` definiuj w pliku view-modelu agregatu, którego DTO rozszerza (czyj to kontrakt API), nie tego, z którego dociągane są dane wzbogacające — importuj VM agregatu wzbogacającego, nie odwrotnie.
4. Metoda rozwiązująca na orkiestratorze agregatu wzbogacającego przyjmuje **tylko UUID** (pojedynczy albo listę) i zwraca **tylko swój własny VM** (`resolveWarrantyVM(uuid): WarrantyVM | null`, tak jak `resolveModelVM(uuid): ModelVM | null`) — nigdy nie przyjmuje ani nie zwraca typu należącego do innego agregatu. Samo łączenie (mapowanie `assignment → { ...assignment, related: resolveXVM(assignment.xUuid) }`) robi orkiestrator agregatu, który jest właścicielem `ItemVM` (z punktu 3), w swoim `_resolveCurrentDeps`.
5. Metoda rozwiązująca zawsze mapuje **1:1** po elemencie wejściowym (nigdy nie filtruje elementów bez rozwiązanej zależności) — inaczej długość/kolejność listy "pływa" w miarę doładowywania danych.
6. Jeśli zauważysz w kodzie pole, które jest tylko ręczną kopią innego pola pod inną nazwą (żeby "nie stracić dostępu") — to sygnał, że powinno zostać zastąpione wzorcem z punktu 2.
7. Jeśli `feature` potrzebuje spłaszczyć `ItemVM[]` z wielu rodziców (np. tabela zbiorcza dla kilku zaznaczonych agregatów) — nie twórz osobnego modelu-adaptera w `feature`. Dodaj do `ItemVM` back-reference (`parentUuid`) i wypełnij go w `_resolveCurrentDeps` razem z resztą wzbogacenia.

---

## 5. Wyspecjalizowane metody odczytu — gdy `search`/`get` nie wystarcza

`search(filters) → uuidy` + `get(uuids) → agregaty` to **baseline** kontrakt dla odczytu po UUID — wystarcza, dopóki UI konsumuje agregat jako płaską listę/tabelę. Nie wystarcza, gdy kształt zapytania jest z natury inny niż "filtry → lista": dane hierarchiczne (drzewo kategorii, struktura organizacyjna, BOM), paginacja per-węzeł ("kolejna strona dzieci tego węzła"), wyszukiwanie z torem przodków (dopasowanie + ścieżka do korzenia, żeby UI mógł rozwinąć drzewo do właściwego miejsca).

To **nie jest wyjątek od zasady orkiestratora** — to rozszerzenie tego samego wzorca o metody, których `TFilters`/`SharedSearchResponse` (płaski `filters → uuid[]`) nie potrafią wyrazić. Orkiestrator zostaje jedynym źródłem prawdy dla agregatu; zmienia się tylko *kształt* zapytania do API, nie właściciel danych.

Referencyjna implementacja: [`catalog-category.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/category/catalog-category.orchestrator.ts), sekcja "Drzewo kategorii". Backend wystawia dla tego dwa dodatkowe endpointy obok zwykłego `search`/`get`: `GetCategoryChildren` (dzieci węzła, paginowane) i `SearchCategoryTree` (dopasowania + ich przodkowie).

```typescript
// catalog-category.orchestrator.ts
private _toTreeNodeVM(node: CategoryTreeNodeDto): CategoryTreeNodeVM {
  const dto: CategoryDto = { uuid: node.uuid, name: node.name, parentUuid: node.parentUuid };
  this.identityMap.set(dto);              // ① nadal zapisuje przez identity map — jedno źródło prawdy
  return {
    ...this.mapToViewModel(dto, {}),       // ② nadal reużywa mapToViewModel — spójne wzbogacenie
    hasChildren: node.hasChildren,
    childCount: node.childCount,
    descendantCount: node.descendantCount, // ③ VM rozszerzony o metadane specyficzne dla węzła drzewa
  };
}

public async getCategoryTreeChildrenAsync(
  parentUuid: string | null,
  pageIndex: number,
  pageSize: number,
): Promise<{ nodes: CategoryTreeNodeVM[]; totalCount: number }> {
  const { nodes, totalCount } = await firstValueFrom(
    this._api.getCategoryChildren({ parentUuid: parentUuid ?? undefined, pageIndex, pageSize }),
  );
  return { nodes: (nodes ?? []).map(n => this._toTreeNodeVM(n)), totalCount: totalCount ?? 0 };
}

public async searchCategoryTreeAsync(
  search: string,
): Promise<{ matches: CategoryTreeNodeVM[]; ancestors: CategoryTreeNodeVM[]; totalCount: number }> {
  const { matches, ancestors, totalCount } = await firstValueFrom(this._api.searchCategoryTree({ search }));
  return {
    matches: (matches ?? []).map(n => this._toTreeNodeVM(n)),
    ancestors: (ancestors ?? []).map(n => this._toTreeNodeVM(n)),
    totalCount: totalCount ?? 0,
  };
}
```

Trzy niezmienniki, których te metody muszą pilnować, żeby orkiestrator dalej był jedynym źródłem prawdy:

1. **Każdy węzeł przechodzi przez `identityMap.set(dto)`.** Nie zwracaj DTO/VM zbudowanego z odpowiedzi API z pominięciem cache — inaczej dane z drzewa i dane z normalnego `loadAsync`/`get` dla tego samego UUID mogą się rozjechać (dwa niezależne obiekty dla jednego agregatu w tej samej sesji).
2. **Mapowanie DTO→VM idzie przez `mapToViewModel`, nie przez ręczne złożenie obiektu.** `CategoryTreeNodeVM` dokłada tylko pola, których nie ma w `CategoryVM` (`hasChildren`, `childCount`, `descendantCount`) — resztę (np. rozwiązany `parent`) dostaje za darmo z tej samej ścieżki co zwykły odczyt.
3. **`CategoryTreeNodeVM` rozszerza `CategoryVM`, nie zastępuje go innym, niezwiązanym typem.** Konsument, który dostał węzeł z drzewa, może go użyć wszędzie tam, gdzie oczekiwany jest zwykły `CategoryVM` — zgodnie z zasadą kowariancji z sekcji 4.

Kiedy sięgać po ten wzorzec: gdy widok (np. `erp-tree` / `erp-tree-picker`) potrzebuje paginacji per-węzeł albo wyszukiwania z kontekstem hierarchii, a nie da się tego wyrazić jako pojedynczy płaski `SearchXRequest`. Metody dodajesz jako zwykłe publiczne `async` metody na tym samym orkiestratorze — bez tworzenia osobnego serwisu "TreeService" obok orkiestratora, bo wtedy powstają dwa niezależne źródła prawdy dla jednego agregatu.

---

## 6. Komendy (mutacje)

Masowe operacje/komendy implementuje się jako publiczne metody `async` na orkiestratorze. Wzorzec: wywołanie API → rejestracja zadania w `JobService` → obsługa błędu przez `addError()`:

```typescript
public async setPriceMultiple(
  command: BatchCommandOfProductSetPriceCommandAndSearchProductRequest,
  queueID?: string,
): Promise<string> {
  try {
    const result = await firstValueFrom(this._api.productSetPriceMultipleCommand(command));
    const jobUuid = result.jobUuid || '';
    this.jobService.addJob(jobUuid, queueID, {
      commandName: 'catalog.product.commands.setPrice',
      timestamp: new Date(),
    });
    return jobUuid;
  } catch (err) {
    this.addError({
      operation: 'command',
      message: err instanceof Error ? err.message : String(err),
      timestamp: new Date(),
    });
    throw err;
  }
}
```

---

## Zobacz też

- Skondensowana wersja tych zasad dla agenta AI: [`.agents/rules/tworzenie-orkiestratora.md`](../../.agents/rules/tworzenie-orkiestratora.md)
- Implementacja bazowa: [`base-orchestrator.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/base-orchestrator.ts), [`orchestrator.types.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/orchestrator.types.ts)
- Pełny przykład wzorca z sekcji 4: [`product.view-model.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/product.view-model.ts) (definicja `ProductWarrantyVM`), [`catalog-warranty.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/warranty/catalog-warranty.orchestrator.ts) (metoda rozwiązująca `resolveWarrantyVMs`)
