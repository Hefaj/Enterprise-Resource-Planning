# Orkiestrator (`BaseOrchestrator`) — kiedy, po co i jak

Ten plik ma Cię nauczyć **rozumieć** orkiestrator, nie tylko go skopiować. Zanim napiszesz kod, sprawdź czy w danym module nie ma już podobnego orkiestratora (np. `catalog-category.orchestrator.ts`) — kopiuj strukturę stamtąd, dopasowując do własnego agregatu.

Pełne, rozwinięte wyjaśnienie z uzasadnieniem (dla człowieka): [`docs/frontend/orchestrators.md`](../../docs/frontend/orchestrators.md).

---

## 1. Kiedy sięgać po orkiestrator

Twórz orkiestrator, gdy w warstwie `data-access` pojawia się **nowy agregat domenowy z bytem w API**: endpoint pobierający po UUID-ach (`getX({ uuids })`) i endpoint wyszukujący (`searchX(filters)`). Sygnały, że go potrzebujesz:

- Ten sam agregat będzie odczytywany z wielu, niezależnych miejsc UI (lista, tab, modal) — bez orkiestratora każde z nich odpytywałoby API osobno.
- Potrzebujesz reaktywnego dostępu (`Signal`) zamiast ręcznego zarządzania `Observable`/subskrypcjami w komponencie.
- Backend wysyła aktualizacje SignalR dla tego agregatu i UI ma się odświeżać samo.
- DTO trzeba wzbogacić o dane innych agregatów (np. produkt + jego kategorie) zanim trafi do UI.

**Kiedy NIE:** jednorazowa akcja bez stanu do cache'owania (np. „wyślij e-mail", „wygeneruj raport") to zwykła metoda serwisu, nie orkiestrator. Nie twórz też orkiestratora dla danych bez `uuid` jako klucza tożsamości — `BaseOrchestrator<TDto, ...>` wymaga `TDto extends HasUuid`.

---

## 2. Po co — jaki problem to rozwiązuje

| Mechanizm | Co daje |
|---|---|
| `IdentityMapStore` | Jedna instancja cache per typ agregatu, per-UUID granularne `Signal` (zmiana jednego rekordu nie przelicza niepowiązanych), eksmisja LRU (`maxCacheSize`) |
| `DataLoader` | Dedup UUID, pomija to co już w cache, grupuje wywołania w oknie `bufferTimeMs`, dzieli duże paczki na `maxChunkSize`, retry z exponential backoff |
| Reaktywne API (`getViewModel`/`getSignalViewModel`/`getOne`) | Komponent dostaje `Signal`, nie musi ręcznie zarządzać subskrypcją ani wiedzieć, skąd dane pochodzą (cache czy świeży fetch) |
| SignalR (`signalrSignature`) | Automatyczne odświeżenie cache, gdy backend zgłosi zmianę agregatu — bez ręcznego invalidowania przez komponenty |
| `mapToViewModel` + rozwiązywanie zależności | DTO → bogaty `ViewModel` z rozwiązanymi powiązaniami do innych agregatów |
| `JobService` (w komendach) | Śledzenie długotrwałych operacji (komend) z raportowaniem błędów |

Innymi słowy: orkiestrator to **jedyne źródło prawdy** dla danego agregatu — komponenty nigdy nie trzymają własnej kopii danych ani nie wołają API bezpośrednio.

---

## 3. Jak działa

### 3.1 Szkielet i wymagane elementy

```typescript
@Injectable({ providedIn: 'root' })
export class CatalogProductOrchestrator extends BaseOrchestrator<
  ProductDto,               // TDto — surowy typ z API (NSwag)
  ProductVM,                // TViewModel — model dla UI
  SearchProductRequest,     // TFilters
  CatalogProductLoadOptions // TLoadOptions — flagi eager-loadingu (albo zwykły `LoadOptions`)
> {
  private readonly _api = inject(CatalogClient);

  protected override readonly signature = 'catalog.product';
  protected override readonly orchestratorConfig = {
    signalrSignature: 'catalog.product',
    maxCacheSize: 1000,   // opcjonalnie: maxChunkSize, bufferTimeMs, maxRetries, retryDelayMs
  };

  protected override fetchByUuids(uuids: string[]): Observable<ProductDto[]> {
    return this._api.getProduct({ uuids });
  }

  protected override searchByFilters(filters: SearchProductRequest): Observable<SearchResponse> {
    return this._api.searchProduct(filters);
  }

  protected override mapToViewModel(dto: ProductDto, resolvedDeps: ResolvedDeps): ProductVM {
    return { ...dto /* + wzbogacone pola, patrz 3.4 */ };
  }
}
```

Orkiestratory to Angularowe singletony (`@Injectable({ providedIn: 'root' })`).

> [!IMPORTANT]
> **Brak powiązań do dociągnięcia?** Nie twórz pustego `XLoadOptions`. Użyj wprost `LoadOptions` z `@erp/shared/data-access`:
> ```typescript
> export class NotificationJobOrchestrator extends BaseOrchestrator<JobDto, JobVM, SearchJobRequest, LoadOptions>
> ```

### 3.2 Cykl życia żądania — `loadAsync`

1. Komponent woła `orchestrator.loadAsync(uuids, options?)`.
2. `DataLoader` dedupikuje UUID-y, odfiltrowuje te już w `IdentityMapStore`, czeka na żądania już-w-locie, buforuje nowe (`bufferTimeMs`), dzieli na chunki (`maxChunkSize`), pobiera przez Twoje `fetchByUuids`, zapisuje wynik w cache.
3. Jeśli podano `options`, wywoływane jest **raz** `resolveEagerDependencies(uuids, options)`.
4. UUID-y trafiają do zbioru załadowanych — od tego zależy, co widać w `getViewModel()`/`getSignalViewModel()`.

`searchAsync(filters, { autoLoad })` działa podobnie: woła `searchByFilters`, dostaje same UUID-y, i (domyślnie) od razu je ładuje przez `loadAsync`.

### 3.3 Odczyt — trzy reaktywne API

| Metoda | Zwraca | Kiedy używać |
|---|---|---|
| `getViewModel()` | `Signal<Map<uuid, VM>>` | listy, gdzie i tak zużywasz całą mapę naraz |
| `getSignalViewModel()` | `Map<uuid, Signal<VM>>` | tabele — zmiana jednego wiersza nie przelicza reszty |
| `getOne(uuid)` | `Signal<VM \| undefined>` | pojedynczy element (np. komórka rozwiązująca się niezależnie) |

Wszystkie trzy wołają pod spodem `mapToViewModel(dto, this._resolveCurrentDeps(dto))`. **`_resolveCurrentDeps` musi być synchroniczne i tanie** (czysty odczyt z już-załadowanego cache sąsiednich orkiestratorów) — jest wywoływane przy każdym przeliczeniu `computed()`, nigdy nie odpytuj w nim API.

### 3.4 Dwie metody do zależności — nie pomyl ich

| | `resolveEagerDependencies(uuids, options)` | `_resolveCurrentDeps(dto)` |
|---|---|---|
| Kiedy | raz, wewnątrz `loadAsync`, gdy podano `options` | przy każdym mapowaniu DTO→VM (sync, w `computed()`) |
| Typ | `async` | sync |
| Robi | zbiera UUID-y powiązań z DTO, woła `loadAsync(...)` na sąsiednich orkiestratorach, żeby dane trafiły do ICH cache | czyta z cache sąsiednich orkiestratorów (`resolveXVM(uuid)`), buduje `ResolvedDeps` |
| Nie robi | — | żadnych requestów, żadnego async |

```typescript
protected override async resolveEagerDependencies(uuids: string[], options: CatalogProductLoadOptions): Promise<void> {
  const categoryUuids = new Set<string>();
  for (const uuid of uuids) {
    const dto = this.identityMap.peek(uuid);
    if (options.includeCategories && dto?.categoryUuids) dto.categoryUuids.forEach(u => categoryUuids.add(u));
  }
  if (categoryUuids.size > 0) await this._categorySiblingOrchestrator.loadAsync([...categoryUuids]);
}

protected override _resolveCurrentDeps(dto: ProductDto): ProductResolvedDeps {
  const categories = dto.categoryUuids ? this._categorySiblingOrchestrator.resolveCategoryVMs(dto.categoryUuids) : [];
  return { categories };
}
```

### 3.5 Cykliczne zależności między orkiestratorami

Product potrzebuje Category, ale Category orchestrator nie powinien znać Product w konstruktorze — DI Angulara nie lubi takich cykli. Wstrzykuj sąsiednie orkiestratory **leniwie**, przez `Injector`, w getterze:

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

### 3.6 Wzbogacanie ViewModelu o powiązania — jak nie tracić danych

`ViewModel` (`XxxVM`) zawsze `extends XxxDto` i dodaje pola, które wymagają połączenia z innym agregatem.

**Prosty przypadek — DTO trzyma sam UUID / listę UUID-ów.** Wzbogacone pole dostaje **inną nazwę**, więc nie ma konfliktu:

```typescript
// DTO: modelUuid: string | null        →  VM: model: ModelVM | null
// DTO: categoryUuids: string[]         →  VM: categories: CategoryVM[]
```

**Trudniejszy przypadek — DTO trzyma listę *obiektów przypisania* pod nazwą, którą chcesz wzbogacić** (np. `warranties: ProductWarrantyDto[]`, gdzie element to `{ warrantyUuid, durationMonths }`). Naturalna nazwa wzbogaconej wersji to też `warranties` — kolizja z polem z DTO.

> [!IMPORTANT]
> **Nigdy nie dodawaj drugiego, zduplikowanego pola** (np. `warrantyAssignments` jako ręczna kopia `dto.warranties`) tylko po to, by „nie stracić dostępu" do surowych danych po nadpisaniu `warranties` innym typem. Zamiast tego rozszerz **typ elementu**, nie tablicę:
>
> ```typescript
> // product.view-model.ts — ItemVM mieszka przy agregacie, którego DTO jest (kontrakt API), nie przy agregacie wzbogacającym
> export interface ProductWarrantyVM extends ProductWarrantyDto {
>   readonly productUuid: string;        // back-reference do rodzica — patrz [!TIP] niżej
>   readonly warranty: WarrantyVM | null; // null, dopóki katalogowa gwarancja nie doładowana
> }
> export interface ProductVM extends ProductDto {
>   readonly warranties: ProductWarrantyVM[]; // bezpieczne nadpisanie (kowariancja) — zero utraty danych z DTO
> }
> ```
>
> Nadpisanie pola tym samym-nazwą, ale kowariantnym podtypem elementu jest bezpieczne w TS i nigdy nie traci danych z DTO — w przeciwieństwie do nadpisania całej tablicy niezwiązanym typem.

> [!IMPORTANT]
> **Resolver na orkiestratorze agregatu wzbogacającego przyjmuje i zwraca TYLKO swój własny typ.** `CatalogWarrantyOrchestrator.resolveWarrantyVM(uuid: string): WarrantyVM | null` — wzorem `resolveModelVM(uuid): ModelVM | null`. Nigdy nie przyjmuje ani nie zwraca typu należącego do innego agregatu (nie importuje `ProductWarrantyDto`/`ProductWarrantyVM`). Samo łączenie — mapowanie 1:1 po elemencie wejściowym, **bez filtrowania** nierozwiązanych (inaczej liczba/kolejność listy „pływa" w miarę doładowywania) — robi orkiestrator-właściciel `ItemVM`, w swoim `_resolveCurrentDeps`:
> ```typescript
> // catalog-product.orchestrator.ts, _resolveCurrentDeps
> const warranties: ProductWarrantyVM[] = (dto.warranties ?? []).map(assignment => ({
>   ...assignment,
>   productUuid: dto.uuid,
>   warranty: this._warrantySiblingOrchestrator.resolveWarrantyVM(assignment.warrantyUuid),
> }));
> ```
> Efekt: żaden orkiestrator nie importuje DTO/VM należącego do innego agregatu — każdy zna wyłącznie własny kontrakt.

> [!TIP]
> **Back-reference na `ItemVM` zamiast adaptera w `feature`.** Gdy UI musi spłaszczyć `ItemVM[]` z **wielu** rodziców w jedną wspólną listę (np. tabela gwarancji dla kilku zaznaczonych produktów naraz — grupowanie po produkcie, `rowId` musi być unikalny globalnie), potrzebny jest UUID rodzica na każdym elemencie. Nie buduj do tego osobnego modelu-adaptera w `feature` (np. `WarrantyRow` mapowany ręcznie z `ProductWarrantyVM`) — dodaj `productUuid` wprost do `ItemVM` (jak wyżej) i wypełnij go w tym samym miejscu w `_resolveCurrentDeps`, gdzie już wzbogacasz element (`productUuid: dto.uuid`). Konsument w `feature` wtedy po prostu robi `products.flatMap(p => p.warranties)` — bez pośredniego mapowania i bez drugiego typu do utrzymania. Przykład: [`warranty-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/tabs/warranty/warranty-tab.component.ts).

> [!TIP]
> **Dobre praktyki lintera:** jeśli `ViewModel` nie dodaje żadnych pól względem `Dto`, zdefiniuj go jako alias typu (`export type JobVM = JobDto;`), nie pusty interfejs (`@typescript-eslint/no-empty-object-type`). W `mapToViewModel`, jeśli nie ma zależności do zmapowania, pomiń parametr `resolvedDeps`, żeby uniknąć `@typescript-eslint/no-unused-vars`.

### 3.7 Dane hierarchiczne (drzewa) — wyspecjalizowane metody odczytu poza search/get

Gdy agregat ma naturę drzewa (kategorie, struktura organizacyjna, BOM) i UI potrzebuje paginacji per-węzeł albo wyszukiwania z torem przodków, płaski `search(filters) → uuid[]` tego nie wyrazi. To **nie jest wyjątek od orkiestratora** — dodaj zwykłe publiczne `async` metody na tym samym orkiestratorze, wołające dedykowane endpointy (np. `GetXChildren`, `SearchXTree`), zamiast tworzyć osobny serwis obok. Wzorzec (patrz `catalog-category.orchestrator.ts`, metody `getCategoryTreeChildrenAsync`/`searchCategoryTreeAsync`):

- każdy zwrócony węzeł idzie przez `this.identityMap.set(dto)` — inaczej dane z drzewa i dane z normalnego `loadAsync` dla tego samego UUID mogą się rozjechać;
- mapowanie DTO→VM idzie przez istniejące `mapToViewModel`, nie przez ręczne złożenie obiektu;
- rozszerzony VM (np. `CategoryTreeNodeVM`) dokłada tylko pola specyficzne dla węzła (`hasChildren`, `childCount`...) i **rozszerza** zwykły VM (kowariancja z 3.6), nie zastępuje go.

Rozwinięcie z pełnym przykładem: [`docs/frontend/orchestrators.md`](../../docs/frontend/orchestrators.md), sekcja 5.

### 3.8 Komendy (mutacje)

Masowe operacje/komendy to publiczne metody `async` na orkiestratorze: wywołanie API → rejestracja zadania w `JobService` → obsługa błędu przez `addError()`.

```typescript
public async setPriceMultiple(command: BatchCommand, queueID?: string): Promise<string> {
  try {
    const result = await firstValueFrom(this._api.productSetPriceCommand(command));
    const jobUuid = result.jobUuid || '';
    this.jobService.addJob(jobUuid, queueID, {
      commandName: PRODUCT_KEYS.commands.setPrice,
      timestamp: new Date(),
    });
    return jobUuid;
  } catch (err) {
    this.addError({ operation: 'command', message: err instanceof Error ? err.message : String(err), timestamp: new Date() });
    throw err;
  }
}
```

---

## 4. Checklist tworzenia nowego orkiestratora

1. Sprawdź istniejący orkiestrator w tym samym module jako wzór strukturalny.
2. `@Injectable({ providedIn: 'root' })`, `extends BaseOrchestrator<TDto, TViewModel, TFilters, TLoadOptions>`.
3. `signature` + `orchestratorConfig.signalrSignature` — unikalne, np. `'catalog.product'`.
4. `fetchByUuids` / `searchByFilters` — deleguj do klienta NSwag.
5. Zdefiniuj `XxxVM` w osobnym `xxx.view-model.ts` — `extends XxxDto`, wzbogacenia zgodnie z sekcją 3.6.
6. `mapToViewModel(dto, resolvedDeps)` — czysta funkcja, zero efektów ubocznych.
7. Jeśli są powiązania: `resolveEagerDependencies` (async, zbiera UUID-y i woła `loadAsync` sąsiadów) + `_resolveCurrentDeps` (sync, czyta z cache sąsiadów). Jeśli brak powiązań: użyj `LoadOptions`, pomiń obie metody.
8. Zależności do sąsiednich orkiestratorów wstrzykuj leniwie przez `Injector` (sekcja 3.5).
9. Komendy jako publiczne `async` metody wg wzorca z 3.8.

## 5. Częste błędy do unikania

- Zduplikowane pole-kopia zamiast wzbogacenia elementu (sekcja 3.6).
- Osobny model-adapter w `feature` (np. `XxxRow`) tylko po to, by dodać UUID rodzica do spłaszczonej listy — zamiast wzbogacić `ItemVM` o back-reference (sekcja 3.6, [!TIP]).
- Resolver przyjmujący/zwracający typ innego agregatu zamiast samego UUID/własnego VM.
- Ciężka logika albo wywołanie API wewnątrz `_resolveCurrentDeps` (musi być tanie i synchroniczne).
- Tworzenie dedykowanego, pustego `XLoadOptions`, gdy wystarczy `LoadOptions`.
- Bezpośrednie wstrzyknięcie sąsiedniego orkiestratora w konstruktorze zamiast leniwie przez `Injector` (ryzyko cyklu DI).

## Zobacz też

- Pełne wyjaśnienie z uzasadnieniem: [`docs/frontend/orchestrators.md`](../../docs/frontend/orchestrators.md)
- Implementacja bazowa: [`base-orchestrator.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/base-orchestrator.ts), [`identity-map.store.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/identity-map.store.ts), [`data-loader.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/data-loader.ts), [`orchestrator.types.ts`](../../frontend/libs/shared/data-access/src/lib/orchestrator/orchestrator.types.ts)
- Przykład najbardziej złożonego orkiestratora w repo: [`catalog-product.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/catalog-product.orchestrator.ts)
