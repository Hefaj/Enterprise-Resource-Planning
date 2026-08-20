# Zasięg zaznaczenia (selection scope) i akcje masowe

Ten dokument opisuje, jak strona z listą + panelami bocznymi ma się zachować, gdy użytkownik kliknie **„Zaznacz wszystko"**, a filtry pasują do tysięcy pozycji: co jest celem akcji masowej, co wolno pokazać w panelu i które akcje muszą wtedy zniknąć z zasięgu ręki.

Implementacja referencyjna: strona produktów katalogu — [`product.store.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/product.store.ts) (właściciel zasięgu), [`product-scope-tab.store.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/content/side-panel/product-scope-tab.store.ts) (wspólna podstawa zakładek zależnych od zaznaczenia), [`multimedia-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/content/side-panel/multimedia/multimedia-tab.component.ts) i [`warranty-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/content/side-panel/warranty/warranty-tab.component.ts) (panele zależne od zaznaczenia), [`product-tab.component.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/content/product-tab.component.ts) (toolbar + modale wsadowe).

Warstwa współdzielona: [`erp-selection.utils.ts`](../../frontend/libs/shared/ui/src/lib/atoms/erp-table/erp-selection.utils.ts) (+ testy [`erp-selection.utils.spec.ts`](../../frontend/libs/shared/ui/src/lib/atoms/erp-table/erp-selection.utils.spec.ts)) oraz atom [`erp-selection-scope-banner`](../../frontend/libs/shared/ui/src/lib/atoms/erp-selection-scope-banner) — zdanie o zasięgu nad panelem.

---

## 1. Dwa byty pod jednym słowem „zaznaczenie"

Zaznaczenie w tabeli serwerowej to nie jeden stan, tylko dwa różne byty o różnych własnościach:

| | Zaznaczenie jako **lista** (ekstensja) | Zaznaczenie jako **filtr** (intensja) |
|---|---|---|
| Stan tabeli | `selectedIds` + `selectedItems` | `isAllSelected` + `filters` + `totalCount` |
| Kontrakt operacji masowej | `targetUuids` | `targetFilter` |
| Rozmiar | znany, mały | nieznany do momentu wykonania |
| Kiedy rozstrzygany | teraz, na froncie | **później, w backendzie**, przy tworzeniu zadania |

System rozróżniał to już wcześniej w dwóch miejscach: `BatchEndpointBase.ResolveTargetsAsync` (patrz [operacje masowe](../backend/bulk-commands.md#3-endpoint--trzy-tryby-jednego-kontraktu)) oraz sama tabela — przy „Zaznacz wszystko" `ErpSelectionState.selectedItems` jest **puste** (zaznaczenie opisuje filtr), a checkboxy pojedynczych wierszy są blokowane.

Brakowało tego w panelach bocznych. Panel, który czyta `selection().selectedItems` wprost, przy zaznaczeniu 12 431 produktów pokazuje pusty ekran „zaznacz produkt" — technicznie zgodnie z odczytem, praktycznie odwrotnie do stanu faktycznego.

**Zasada, z której wynika reszta dokumentu:** panel jest **dowodem** (pokazuje, czego dotyczy operacja), a nie źródłem prawdy o jej celu. Celem jest zasięg.

---

## 2. Trzy zasięgi i próg materializacji

```typescript
export type ErpSelectionScope<TItem, TFilter> =
  | { kind: 'none' }
  | { kind: 'explicit'; ids: string[]; items: TItem[]; count: number; materialized: boolean; loading: boolean }
  | { kind: 'query';    filter: TFilter; count: number };
```

| Zasięg | Kiedy | Co wolno w UI |
|---|---|---|
| `none` | brak zaznaczenia | akcje sekcyjne (globalne) |
| `explicit` | znana lista identyfikatorów | pełny widok, granularny wybór wewnątrz paneli |
| `query` | filtr o znanej liczności | próbka w panelu, brak granularnego wyboru, akcje wyrażalne nad zbiorem |

Kluczowa decyzja: **o trybie rozstrzyga liczność, nie flaga `isAllSelected`**. Zaznaczenie „wszystkiego" przy wąskim filtrze jest rozwiązywane (materializowane) do listy identyfikatorów i od tego momentu jest nieodróżnialne od ręcznego zaznaczenia:

```typescript
public readonly scope = computed(() =>
  erpResolveSelectionScope<ProductVM, SearchProductRequest>(this.selection(), {
    materializeLimit: PRODUCT_SELECTION_MATERIALIZE_LIMIT,
    materializedIds: materialized?.token === token ? materialized.uuids : null,
  })
);
```

Dzięki temu tryb ograniczony włącza się dopiero tam, gdzie naprawdę musi — użytkownik zaznaczający „wszystko" przy pięciu wynikach nigdy nie dowiaduje się, że taki tryb istnieje.

### Jak dobrać próg

Licz **rodziców** (pozycje listy głównej), nie dzieci: to one generują żądania — orkiestrator chunkuje po 100, więc próg 100 mieści się w jednym–dwóch żądaniach, a szczegóły pozycji podrzędnych i tak doładowują się leniwie przy scrollowaniu. Próg jest stałą modułu (`PRODUCT_SELECTION_MATERIALIZE_LIMIT`), nie magiczną liczbą rozsianą po komponentach.

### Materializacja przełącza cel na identyfikatory — celowo

Zmaterializowany zasięg adresuje `targetUuids`, **nie** filtr, mimo że powstał z filtra. To nie jest szczegół implementacyjny, tylko obietnica WYSIWYG: użytkownik widzi pięć konkretnych pozycji, więc operacja obejmie dokładnie te pięć — a nie szóstą, która wpadła w filtr sekundę przed kliknięciem.

Odwrotna zasada obowiązuje w trybie `query`: tam cele rozwiązuje backend przy tworzeniu zadania, więc pokazana liczność jest **szacunkiem**. Nazywaj ją w UI szacunkiem, zamiast udawać precyzję, której kontrakt nie daje.

---

## 3. Cele operacji masowych — jeden helper, zero ręcznego składania

```typescript
this.modalService.open<BatchCommandOfProductSetNameCommandAndSearchProductRequest, ErpBatchMetadata>(
  SET_NAME_MODAL_ID,
  erpBuildBatchTargets<SearchProductRequest>(this.store.scope()),
  { targetCount: this.selectionCount() },
);
```

`erpBuildBatchTargets` jest **jedynym** miejscem decydującym „uuidy czy filtr". Komponent, który składa `{ targetUuids: selection?.selectedIds, targetFilter: selection?.filters }` ręcznie, powiela regułę, która żyje w dwóch warstwach naraz (front + `ResolveTargetsAsync`) i rozjedzie się przy pierwszej zmianie.

`targetCount` idzie **metadanymi** (`ErpBatchMetadata`), nie komendą — kontrakt HTTP `BatchCommand` jest zamrożony dla klientów NSwag, a modal potrzebuje liczby tylko po to, żeby pokazać „ile pozycji obejmie operacja".

Liczność zasięgu czytaj przez `erpSelectionScopeCount(scope)` (a nie `erpSelectionCount(selection)`, które operuje na surowym stanie tabeli) — w trakcie materializacji zwraca docelową liczność, nie zero.

---

## 4. Panel zależny od zaznaczenia w trybie `query`

Trzy reguły, wszystkie zaszyte w [`product-scope-tab.store.ts`](../../frontend/libs/modules/catalog/feature/src/lib/product/page/content/side-panel/product-scope-tab.store.ts) — store'y poszczególnych zakładek (multimedia, gwarancje…) dziedziczą je zamiast odtwarzać po swojemu:

**1. Próbka zamiast listy.** Panel ładuje kilka pierwszych rodziców (`PRODUCT_SCOPE_PREVIEW_LIMIT = 10`), rozwiązanych tym samym mechanizmem co materializacja (`ProductStore.resolveUuids(filters, limit)` — z cache per (filtry, limit)). Scroll nie doładowuje kolejnych: to próbka i ma taką się czuć.

**2. Zdanie o zasięgu nad tabelą.** Promień rażenia musi być widoczny bez klikania:

> Podgląd **10** z **1500** produktów pasujących do filtrów
> Akcje masowe obejmą wszystkie pasujące produkty, nie tylko widoczne poniżej.

Renderuje je atom `erp-selection-scope-banner` — sam rozstrzyga po zasięgu, czy pokazać ostrzegawczy baner próbki (`query`), spokojne potwierdzenie po materializacji, czy nic (zwykłe zaznaczenie, w którym nie ma czego tłumaczyć):

```typescript
protected readonly scopeBannerConfig = ErpSelectionScopeBannerBuilder.create(b => b
  .setScope(this.tabStore.scope)
  .setShownCount(this.tabStore.shownProductCount)
  .setPreviewTitle(PRODUCT_KEYS.base.selectionScope.previewTitle)
  .setPreviewDescription(PRODUCT_KEYS.base.selectionScope.previewDescription)
  .setAllTitle(PRODUCT_KEYS.base.selectionScope.allTitle)
);
```

Bez podanych tekstów atom bierze ogólne `SHARED_KEYS.selectionScope.*` („pozycji"); moduł nadpisuje je, gdy chce nazwać rodziców po imieniu („produktów").

**3. Brak granularnego wyboru** — `selectionMode: 'none'`, więc znikają checkboxy wierszy **i** grup. Checkbox obiecuje „operacja obejmie dokładnie to", a przy próbce z tysięcy to nieprawda; lepiej odebrać obietnicę niż ją złamać. To ta sama reguła, którą tabela stosuje do własnych wierszy przy „Zaznacz wszystko" — spójność robi tu robotę za dokumentację.

Konfiguracja tabeli musi być wtedy `computed`, bo tryb zaznaczenia zależy od zasięgu:

```typescript
protected readonly tableConfig = computed<ErpTableConfig<MultimediaRow>>(() =>
  ErpTableBuilder.create<ErpTableBuilder<MultimediaRow>>(table => table
    .setSelectionMode(this.tabStore.canSelectChildren() ? 'multi' : 'none')
    // ...
  )
);
```

**Podzaznaczenie ginie razem ze zmianą zbioru rodziców** — inaczej „usuń zaznaczone" zadziałałoby na pliki produktu, którego nie ma już w panelu.

### Kolejność w panelu = kolejność w tabeli

Panel renderuje rodziców w kolejności `scope.ids`, więc to zaznaczenie musi nieść kolejność tabeli, a nie kolejność klikania. Składają się na to dwie rzeczy:

- **Zaznaczenie ręczne** — `ErpTableComponent` pamięta globalną pozycję każdego zaznaczonego wiersza (`pageIndex * pageSize + indeks`) i emituje `selectedIds` posortowane po niej (`erpOrderIdsByPosition`). Dzięki temu zaznaczenie ze strony trzeciej i pierwszej wraca w kolejności tabeli, mimo że wierszy z poprzedniej strony nie ma już w pamięci. Pozycje zapisujemy **tylko w momencie zmiany zaznaczenia** (i nigdy w trakcie ładowania): przy samej zmianie strony `pageIndex` wskazuje już nową stronę, a wyrenderowane wiersze są jeszcze ze starej, więc policzone wtedy pozycje wrzuciłyby zaznaczenie z poprzedniej strony nad to z następnej.
- **Zaznaczenie zmaterializowane** — `ProductStore.resolveUuids` dokłada do zapytania bieżące `sorts` tabeli (strona dostaje je outputem `sortsChange`, bo sortowanie żyje w stanie tabeli, nie w filtrach). Sortowanie wchodzi też do tokenu cache'u uuidów — inaczej po przesortowaniu panel pokazywałby kolejność sprzed zmiany.

**Zmiana sortowania albo filtrów czyści zaznaczenie** (`ErpTableComponent`). Oba opisy zaznaczenia — lista identyfikatorów i filtr z „Zaznacz wszystko" — dotyczą konkretnego zbioru i konkretnej kolejności; po zmianie przestają być prawdą, a przeniesione po cichu dałyby akcje masowe celujące w pozycje, których użytkownik na ekranie już nie widzi. Lepiej kazać zaznaczyć od nowa niż wykonać operację na zbiorze sprzed zmiany.

---

## 5. Bramkowanie akcji toolbara

Podział `defaultGroups` / `selectionGroups` odpowiada na pytanie „czy coś jest zaznaczone". Brakowało drugiej osi: **czy ta akcja da się w ogóle wyrazić nad zbiorem opisanym filtrem**.

```typescript
ErpActionToolbarBuilder.create(b => b
  .setSelectionScope(this.tabStore.scopeKind)          // sygnał z rodzajem zasięgu
  .addSelectionGroup(g => g
    .addAction(a => a
      .setId('delete-selected')
      .setScopes(['explicit'])                          // wymaga WSKAZANYCH pozycji
      .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
      .setFn(() => this.onDeleteSelectedMedia())
    )
  )
);
```

- Akcja **bez** `scopes` działa w każdym zasięgu (zgodność wstecz — istniejące toolbary nie wymagają zmian).
- Akcja z niepasującym zasięgiem jest **blokowana z podpowiedzią, nie ukrywana**: znikające przyciski rozjeżdżają układ, który użytkownik sam sobie przypiął (`pinnedActionIds`, `customShortcuts`), i nie tłumaczą, dlaczego akcja przepadła. Domyślna podpowiedź: `SHARED_KEYS.actionToolbar.toolbar.unavailableInScope`.
- Bramka działa na poziomie **grup**, więc obejmuje naraz przypięte przyciski, Mega Menu i skróty klawiszowe (te sprawdzają `action.disabled`).
- Podpowiedź renderuje się na opakowaniu przycisku, nie na nim samym — zablokowany `<button>` nie dostaje zdarzeń myszy, więc `title` postawiony wprost na nim nigdy by się nie pokazał.

Które akcje ograniczać: te, które potrzebują **tożsamości pozycji** (zmiana kolejności, ustawienie pozycji głównej, operacje na podzaznaczeniu). Akcje wyrażalne jako komenda nad zbiorem (usuń, ustaw wartość, eksportuj, wygeneruj) zostają dostępne — backend rozwiąże `targetFilter` i wykona je jako zadanie masowe.

---

## 6. Przepis: nowy panel zależny od zaznaczenia

### Nowa zakładka strony produktów — dziedzicz, nie przepisuj

```typescript
@Injectable() // rejestrowany na poziomie komponentu zakładki
export class WarrantyTabStore extends ProductScopeTabStore<ProductWarrantyVM> {
  // tylko to, co specyficzne: payload akcji operujących na wskazanych pozycjach
  public readonly selectedWarrantiesByProduct = computed(() => { /* z selectedChildren() */ });

  constructor() {
    super(WARRANTY_PREVIEW_PRODUCT_LIMIT);
  }
}
```

Z bazy zakładka dostaje gotowe: `scope`/`scopeKind`/`scopeCount`, `products` (modele widoku z orkiestratora po UUID — czyli też aktualizacje z SignalR), `shownProductCount`, `resolving`, `canSelectChildren`, `selectedChildren` z licznikiem i czyszczeniem przy zmianie zbioru rodziców oraz `batchTargets()`. Komponent dokłada wyłącznie swoje wiersze, kolumny, doładowywanie szczegółów i akcje.

### Panel w innym module (bez `ProductScopeTabStore`)

1. **Store strony** wystawia `scope` (`computed` z `erpResolveSelectionScope`) i `scopeKind`; materializację obsługuje `effect` odpalany przy `isAllSelected` poniżej progu, z odrzucaniem wyników nieaktualnych filtrów (token z filtrów).
2. **Panel czyta `scope`, nigdy `selection` wprost.** Modele widoku bierz z orkiestratora po UUID — zaznaczenie zmaterializowane nie niesie ze sobą pozycji, a odczyt z orkiestratora daje przy okazji aktualizacje z SignalR.
3. **Tryb `query`** → próbka N rodziców + `erp-selection-scope-banner` + `selectionMode: 'none'`.
4. **Tryb `explicit` z `loading: true`** (materializacja w toku) → stan „rozwiązywanie zaznaczenia", nie pusty ekran i nie baner trybu filtra.
5. **Toolbar** dostaje `.setSelectionScope(...)`, a akcje wymagające wskazanych pozycji — `.setScopes(['explicit'])` + `.setUnavailableHint(...)`.
6. **Akcje masowe** budują cele przez `erpBuildBatchTargets(scope)` i przekazują `targetCount` metadanymi.
7. **Teksty** — wyłącznie klucze Transloco (patrz [tłumaczenia](./translations.md)). Wspólne dla całej strony produktów: `PRODUCT_KEYS.base.selectionScope.{resolving,allTitle,previewTitle,previewDescription}`; per zakładka zostaje tylko podpowiedź o zablokowanej akcji (`…multimedia.panel.scopeFileSelectionUnavailable`, `…warranty.panel.scopeWarrantySelectionUnavailable`). Domyślne, ogólne teksty banera: `SHARED_KEYS.selectionScope.*`.

---

## 7. Częste błędy

- **Czytanie `selection().selectedItems` w panelu** — przy „Zaznacz wszystko" to puste pole; panel pokazuje „nic nie zaznaczono" przy tysiącach zaznaczonych pozycji.
- **Decydowanie o trybie po `isAllSelected`** zamiast po liczności — pięć produktów dostaje wtedy tryb ograniczony bez powodu.
- **Ręczne składanie `targetUuids`/`targetFilter`** w komponencie zamiast `erpBuildBatchTargets`.
- **Zostawienie checkboxów w trybie `query`** — obietnica, której akcja nie dotrzyma.
- **Adresowanie filtrem po materializacji** — użytkownik widzi pięć pozycji, a operacja obejmuje to, co filtr zwróci w chwili wykonania.
- **Brak zdania o zasięgu** przy akcjach nad filtrem — użytkownik nie zna promienia rażenia, dopóki nie zobaczy raportu zadania.
- **Ukrywanie zablokowanych akcji** zamiast blokowania z podpowiedzią.
- **Powielanie mechaniki zasięgu w nowej zakładce** zamiast dziedziczenia po `ProductScopeTabStore` — progi, próbki i momenty czyszczenia podzaznaczenia rozjeżdżają się po pierwszej zmianie.

---

## 8. Czego (świadomie) jeszcze nie ma

- **Filtr multimediów po stronie backendu.** `SearchMultimediaRequest` ma dziś tylko `Uuids` — nie ma ani „multimedia produktów pasujących do filtra X", ani taniego `COUNT` plików. Dlatego baner podaje liczbę **produktów**, nie plików, a akcje masowe panelu multimediów pozostają zaślepkami (niosą już poprawne cele). Docelowo: `ProductFilter` + kryteria mediów w requeście, `BatchEndpointBase<…, SearchMultimediaRequest>` z joinem `product → product_multimedia_link → multimedia`, `job_item` per plik.
- **Granulacja przez kryteria w trybie `query`** („wszystkie pliki bez miniatury", „tylko obrazy") — naturalne rozszerzenie punktu wyżej: przy dziesiątkach tysięcy plików precyzję wyraża predykat, nie lista identyfikatorów.
- **Dwustopniowe „Zaznacz wszystko"** w `erp-table` (najpierw bieżąca strona, potem baner „Zaznacz wszystkie N pasujących do filtrów"). Dziś checkbox nagłówka od razu wchodzi w tryb filtra, więc użytkownik podejmuje decyzję o zasięgu, nie widząc liczby w tym momencie. Zmiana dotyczy każdej tabeli serwerowej — warto ją zrobić jako opcję konfiguracji.
- **„Zaznacz wszystko minus wyjątki"** (`excludedIds` w stanie tabeli + `ExcludedUuids` w `BatchCommand`) — czysto addytywne, ale komplikuje licznik i podgląd; sensowne dopiero, gdy użytkownicy sami się o to upomną.

---

## 9. Zobacz też

- [Page dla agregatu](./pages.md) — gdzie zasięg zaznaczenia mieszka w szkielecie całej strony (store, zakładki, panel boczny)
- [Operacje masowe (backend)](../backend/bulk-commands.md) — `job`/`job_item`, `BulkCommandRunner`, częściowy sukces, cancel/retry
- [Walidacja wsadowa](../backend/batch-validation.md) — pre-check przed utworzeniem zadania, górne ograniczenia wsadu
- [Modale](./modals.md) — modale wsadowe, `ErpBatchMetadata`
- [Orkiestratory](./orchestrators.md) — `searchAsync`, rozwiązywanie UUID → ViewModel, komendy masowe
- [Atomy UI](./atoms.md) — wzorzec buildera, którym rozszerzano toolbar i tabelę
