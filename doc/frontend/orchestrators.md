# Orkiestratory (warstwa `data-access`)

Orkiestrator to serwis Angularowy (singleton, `providedIn: 'root'`), który jest właścicielem stanu dla jednego agregatu domenowego (np. `Product`, `Category`, `Warranty`). Odpowiada za:

- pobieranie danych z API (pojedynczo i w paczkach, z deduplikacją),
- trzymanie ich w pamięci podręcznej (`IdentityMapStore`, LRU),
- nasłuchiwanie aktualizacji z SignalR i odświeżanie cache w czasie rzeczywistym,
- mapowanie surowego `DTO` (to, co przyjeżdża z API) na bogaty `ViewModel` (to, czego używa UI),
- wystawianie reaktywnego API opartego o Signals (`getViewModel()`, `getSignalViewModel()`, `getOne()`).

Bazowa implementacja: [`base-orchestrator.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/base-orchestrator.ts). Każdy orkiestrator dziedziczy z `BaseOrchestrator<TDto, TViewModel, TFilters, TLoadOptions>`.

Przykład referencyjny w tym dokumencie: `CatalogProductOrchestrator` ([`catalog-product.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/catalog-product.orchestrator.ts)), który wzbogaca produkt o kategorie, model, multimedia i gwarancje.

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
  warranty: this._warrantySiblingOrchestrator.resolveWarrantyVM(assignment.warrantyUuid), // dociągane stopniowo
}));
```

Efekt: **żaden orkiestrator nie importuje typów DTO/VM należących do innego agregatu** — każdy zna tylko swój własny kontrakt (uuid wchodzi, własny VM wychodzi) i typy DTO, które faktycznie zwraca jego własny endpoint. Konsument w komponencie od razu ma stabilną liczbę wierszy (`product.warranties.length` nie zmienia się w miarę doładowywania), a szczegóły katalogowe (`.warranty?.name`, `.warranty?.description`) pojawiają się, gdy tylko są dostępne — bez osobnego, ręcznie synchronizowanego pola.

**Efekt uboczny na plus:** DTO przypisania (`ProductWarrantyDto.durationMonths` — okres dla *tego* produktu) i katalogowe DTO (`WarrantyDto.durationMonths` — okres standardowy) mają tę samą nazwę pola, ale różne znaczenie. Zagnieżdżenie (`warranty.durationMonths` vs `durationMonths` na poziomie przypisania) eliminuje kolizję bez potrzeby sztucznego przemianowywania jednego z nich (np. na `productDurationMonths`).

### Checklista przy dodawaniu wzbogaconego pola do `XxxVM`

1. Czy DTO trzyma **sam UUID / listę UUID-ów**? → dodaj pole o **innej nazwie** z pełnym obiektem (`modelUuid` → `model`, `categoryUuids` → `categories`). Prosty przypadek, nic więcej nie trzeba robić.
2. Czy DTO trzyma **listę obiektów przypisania** (a nie gołych UUID-ów) i naturalna nazwa wzbogaconej wersji koliduje z nazwą pola w DTO? → **nie** twórz osobnego, zduplikowanego pola. Zdefiniuj `ItemVM extends ItemDto` z dodatkowym polem-referencją (`| null` dopóki nierozwiązane) i nadpisz pole w `XxxVM` tym samym podtypem.
3. `ItemVM` definiuj w pliku view-modelu agregatu, którego DTO rozszerza (czyj to kontrakt API), nie tego, z którego dociągane są dane wzbogacające — importuj VM agregatu wzbogacającego, nie odwrotnie.
4. Metoda rozwiązująca na orkiestratorze agregatu wzbogacającego przyjmuje **tylko UUID** (pojedynczy albo listę) i zwraca **tylko swój własny VM** (`resolveWarrantyVM(uuid): WarrantyVM | null`, tak jak `resolveModelVM(uuid): ModelVM | null`) — nigdy nie przyjmuje ani nie zwraca typu należącego do innego agregatu. Samo łączenie (mapowanie `assignment → { ...assignment, related: resolveXVM(assignment.xUuid) }`) robi orkiestrator agregatu, który jest właścicielem `ItemVM` (z punktu 3), w swoim `_resolveCurrentDeps`.
5. Metoda rozwiązująca zawsze mapuje **1:1** po elemencie wejściowym (nigdy nie filtruje elementów bez rozwiązanej zależności) — inaczej długość/kolejność listy "pływa" w miarę doładowywania danych.
6. Jeśli zauważysz w kodzie pole, które jest tylko ręczną kopią innego pola pod inną nazwą (żeby "nie stracić dostępu") — to sygnał, że powinno zostać zastąpione wzorcem z punktu 2.

---

## 5. Komendy (mutacje)

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
