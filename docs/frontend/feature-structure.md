# Struktura katalogów agregatu w warstwie `feature`

Ten dokument opisuje **gdzie kłaść pliki** wewnątrz `libs/modules/MODULE_NAME/feature/src/lib/AGGREGATE/`. Nie opisuje, jak te pliki mają wyglądać w środku — od tego są [pages.md](./pages.md), [smart-tables.md](./smart-tables.md), [modals.md](./modals.md), [selection-scope.md](./selection-scope.md).

Implementacja referencyjna: [`catalog/feature/src/lib/product/`](../../frontend/libs/modules/catalog/feature/src/lib/product/) — każdy kolejny agregat ma wyglądać tak samo, żeby ścieżka do pliku była do przewidzenia bez przeszukiwania drzewa.

---

## 1. Szkielet

```
libs/modules/MODULE_NAME/feature/src/lib/AGGREGATE/
├── components/                                 # smart komponenty wielokrotnego użytku (§2)
│   └── tables/
│       └── MODULE-AGGREGATE-table/
│           ├── MODULE-AGGREGATE-table.component.ts
│           └── NAZWA-cell.component.ts         # komórki tylko tej tabeli
├── modal/                                      # modale edycyjne agregatu (§3)
│   ├── index.ts
│   └── NAZWA-AKCJI/
│       ├── index.ts
│       ├── NAZWA-AKCJI.definition.ts
│       └── NAZWA-AKCJI.step.ts
├── page/                                       # wszystko, co renderuje strona agregatu (§4)
│   ├── AGGREGATE.component.ts                  # szkielet erp-grid-layout          — zawsze
│   ├── AGGREGATE.store.ts                      # store strony                      — zawsze
│   ├── filters/
│   │   └── AGGREGATE-filter.component.ts       # obszar `filter`                   — zawsze
│   └── content/                                # treść strony                      — zawsze
│       ├── AGGREGATE-tab.component.ts          # obszar `content` — toolbar + smart tabela
│       └── side-panel/                         # obszar `rightPanel` — tylko gdy są zakładki
│           ├── AGGREGATE-scope-tab.store.ts    # wspólna baza store'ów paneli
│           └── CHILD_NAME/                     # jedna zakładka boczna = jeden podkatalog
│               ├── CHILD_NAME-tab.component.ts
│               ├── CHILD_NAME-tab.store.ts
│               ├── CHILD_NAME-row.model.ts     # kształt wiersza, jeśli spłaszczony
│               └── CHILD_NAME-*-cell.component.ts
└── translation/                                # pl-PL.json, en-US.json, keys.ts, index.ts (§5)
```

**W `lib/` nie leżą żadne pliki luzem — wyłącznie katalogi jednostek.** Jednostką jest agregat (`product/`, `users/`), ale też strona modułu, która agregatu nie ma: dashboard startowy modułu to `lib/dashboard/` z `page/dashboard.component.ts` i własnym `translation/` (scope `identity`/`catalog`/… to po prostu scope tej strony — pozostałe strony mają swoje). Dashboard bywa placeholderem bez filtra, listy i store'a; brakujące części po prostu nie istnieją, ale te, które są, leżą tam gdzie zawsze. Nie ma „modułowego" poziomu obok jednostek — jeśli coś naprawdę jest wspólne dla całego modułu, jego miejsce to `util`/`ui`/`data-access` modułu, nie luźny plik w `feature/src/lib/`.

Cztery katalogi najwyższego poziomu (`components`, `modal`, `page`, `translation`) są **stałe** — agregat może nie mieć któregoś (np. brak modali), ale nigdy nie dokłada piątego. Wszystko, co nie pasuje do żadnego z nich, prawdopodobnie nie należy do warstwy `feature` — patrz [architektura](./architecture.md) (`ui` dla komponentów prezentacyjnych, `util` dla helperów/modeli, `data-access` dla orkiestratorów).

---

## 2. `components/` — smart komponenty wielokrotnego użytku

Tu trafia komponent, który **ma więcej niż jednego konsumenta albo jest eksportowany z barrela** `src/index.ts` (bo używa go inny moduł, kontrakt albo modal). Kryterium jest jedno: *czy poza stroną tego agregatu ktoś to renderuje?* Jeśli nie — plik należy do `page/content/` (§4), nie tutaj.

Przykłady: smart tabela agregatu (używana przez stronę **i** przez modale/inne moduły), picker drzewa kategorii (używany przez filtr produktów).

**Podział na podkatalogi wg rodzaju komponentu**: `tables/`, `trees/`, `pickers/`, `lists/`, `charts/` — dokładaj kolejny rodzaj dopiero, gdy pojawi się pierwszy komponent tego rodzaju. Rodzaj jest zawsze w liczbie mnogiej i opisuje formę prezentacji, nie domenę (`tables/`, nie `product-tables/`).

**Jeden komponent = jeden podkatalog** wewnątrz rodzaju, nazwany jak komponent. Satelity używane tylko przez ten komponent (komórki tabeli, modele wiersza) leżą w tym samym podkatalogu — nie wędrują do `util` ani do wspólnego `cells/`.

Nazwa pliku i selektor niosą prefiks modułu, bo te komponenty wychodzą poza moduł: `catalog-product-table.component.ts` → `erp-catalog-product-table`.

---

## 3. `modal/` — modale edycyjne agregatu

Jeden podkatalog na modal (`set-name/`, `set-price/`), w nim `*.definition.ts` + `*.step.ts` + `index.ts`, a na wierzchu `modal/index.ts` re-eksportujący wszystkie modale agregatu — to on jest re-eksportowany z barrela biblioteki i to jego widzi `entry.modals.ts` kontraktu. Szczegóły zawartości: [modals.md](./modals.md).

Modale są tu, a nie w `page/`, celowo: otwiera je toolbar strony, ale ładowane są leniwie przez `ErpModalService` i mogą być otwarte z dowolnego miejsca aplikacji — nie są częścią drzewa komponentów strony.

---

## 4. `page/` — wszystko, co renderuje strona agregatu

Wszystko w `page/` jest **prywatne dla strony**: poza `AGGREGATE.component.ts` nic stąd nie trafia do `src/index.ts`.

### 4.1 Część stała — zawsze te trzy rzeczy

Każda strona, niezależnie od agregatu, ma dokładnie te elementy, zawsze pod tymi samymi nazwami:

| Plik | Rola |
|---|---|
| `AGGREGATE.component.ts` | szkielet `erp-grid-layout` — deklaracja obszarów siatki, nic więcej ([pages.md §1](./pages.md#1-szkielet-erp-grid-layout)) |
| `AGGREGATE.store.ts` | store strony — filtry, sortowanie, zaznaczenie, zasięg ([pages.md §4](./pages.md#4-store-strony--jedno-źródło-prawdy-o-filtrach-i-zaznaczeniu)) |
| `filters/AGGREGATE-filter.component.ts` | obszar `filter` — `ErpFilterBuilder`, woła store ([pages.md §2](./pages.md#2-filtry-filter)) |

`filters/` jest osobnym katalogiem, mimo że zwykle trzyma jeden plik — filtr rozrasta się o pola niestandardowe (`addCustomFormField`), które mają wtedy gdzie zamieszkać obok niego.

### 4.2 `content/` — część zmienna

Reszta strony to treść: zakładki, panele, sekcje. Wszystko to idzie do jednego katalogu `content/`, żeby nie mnożyć płytkich katalogów pod `page/` przy każdym nowym kawałku widoku.

Podział wewnątrz `content/` jest **po miejscu renderowania**, nie po domenie:

- **bezpośrednio w `content/`** — to, co wypełnia obszar `content` siatki (action toolbar + smart tabela). Nazwa katalogu i nazwa obszaru siatki są tą samą nazwą celowo — plik leżący płasko w `content/` to plik, który widać w obszarze `content`. Nazwa pliku mówi, czym ten komponent jest na tej stronie:
  - `AGGREGATE-tab.component.ts` — gdy strona ma zakładki, bo wtedy jest to jednocześnie pierwsza z nich (`product-tab`, `users-tab`, `roles-tab`),
  - `AGGREGATE-list.component.ts` albo inna nazwa opisowa — gdy zakładek nie ma i nic tu nie jest zakładką (`grant-audit-list`, `permissions-catalog-list`).

  Nie nazywaj go `AGGREGATE-content.component.ts` — słowo „content" niesie już katalog, w którym plik leży.
- **`content/side-panel/`** — zakładki obszaru `rightPanel`, czyli panele zależne od zaznaczenia ([pages.md §6](./pages.md#6-panel-boczny-zależny-od-zaznaczenia-kolejne-zakładki-rightpanel)). Wspólna baza ich store'ów (`AGGREGATE-scope-tab.store.ts`) leży płasko w `side-panel/`, bo jest dzielona przez wszystkie panele; każdy panel dostaje własny podkatalog ze swoim komponentem, store'em, modelem wiersza i komórkami.

Zakładki zagnieżdżone (`children: [...]` w `addTab`) dostają jeden wspólny podkatalog rodzica — np. `side-panel/sales-offer/` z `exclusion-tab.component.ts` i `delivery-tab.component.ts` — bez powielania słowa `tabs` w nazwie katalogu (sufiks `-tab` w nazwie pliku już to mówi).

Strona bez zakładek ma samo `content/AGGREGATE-tab.component.ts`, bez `side-panel/`. Jeśli strona kiedyś dostanie treść, która nie jest ani obszarem `content`, ani zakładką panelu bocznego (np. stały pasek podsumowania), dostaje kolejny podkatalog `content/` nazwany po swoim miejscu w siatce — nie nowy katalog obok `content/`.

---

## 5. `translation/`

`pl-PL.json`, `en-US.json`, `index.ts` (provider scope'u) i **autogenerowany** `keys.ts`. Scope tłumaczeń jest per agregat, nie per moduł — dlatego katalog jest tutaj, a nie w `lib/`. Nigdy nie edytuj `keys.ts` ręcznie; po dodaniu kluczy do JSON-ów uruchom `pnpm translate:keys`. Szczegóły: [translations.md](./translations.md).

---

## 6. Decyzja w jednym pytaniu

Nowy plik, nie wiadomo gdzie:

1. Czy renderuje go coś poza stroną tego agregatu (inny moduł, kontrakt, modal)? → `components/RODZAJ/NAZWA/`
2. Czy to modal otwierany przez `ErpModalService`? → `modal/NAZWA-AKCJI/`
3. Czy to szkielet, store strony albo filtr? → płasko w `page/` (`filters/` dla filtra)
4. Czy renderuje się w prawym panelu? → `page/content/side-panel/CHILD_NAME/`
5. Reszta treści strony → `page/content/`
6. Nic z powyższych → to nie jest plik warstwy `feature`; szukaj miejsca w `ui`, `util` albo `data-access` ([architektura](./architecture.md))

---

## 7. Częste błędy

- **Smart tabela w `page/content/`, bo „używa jej tylko ta strona"** — tabela agregatu jest eksportowana z barrela i prędzej czy później renderuje ją modal albo inny moduł; jej miejsce to `components/tables/`.
- **Komponent komórki albo model wiersza wypchnięty do `util`** — jeśli używa go jedna tabela/zakładka, leży obok niej. `util` jest dla rzeczy dzielonych przez cały moduł.
- **Płaskie `page/` z `AGGREGATE-content.component.ts`, `AGGREGATE-filter.component.ts` i `tabs/` obok siebie** — starszy układ (patrz §8); treść idzie do `content/`, filtr do `filters/`.
- **Katalog `tabs/` zamiast `content/side-panel/`** — nazwa `tabs` mówi o widżecie, nie o miejscu w siatce, i nie ma gdzie zmieścić treści, która zakładką nie jest.
- **Podkatalog rodzaju w `components/` zakładany „na zapas"** (`lists/` z jednym pustym katalogiem) — rodzaj powstaje razem z pierwszym komponentem tego rodzaju.
- **Piąty katalog najwyższego poziomu** (`services/`, `models/`, `helpers/`) — to sygnał, że plik należy do `data-access` albo `util`, nie do `feature`.

---

## 8. Stan zgodności

Zgodne z tym dokumentem: cały `catalog/feature` (`product`, `category`) i cały `identity/feature` (`dashboard`, `users`, `roles`, `grant-audit`, `permissions`).

Do przemigrowania przy najbliższej większej zmianie w tych plikach (nie ruszaj ich „przy okazji" innego zadania):

- `notification/feature/src/lib/job/` — ma poprawne `page/`, ale z katalogiem `tabs/` zamiast `content/`, `components/notification-job-table/` bez poziomu rodzaju (`tables/`) i osobnym `job-list/` poza `page/`.
- `inventory/feature/src/lib/inventory.component.ts` i `sales/feature/src/lib/sales.component.ts` — placeholdery leżące luzem w `lib/`, wygenerowane starą wersją przepisu z [new-module.md](./new-module.md); ich miejsce to `lib/dashboard/page/dashboard.component.ts`.

Odstępstwa, które **nie** są kwestią struktury katalogów i nie naprawia ich przeniesienie plików:

- `identity/roles` nie ma filtra — jego siatka to `['tabs tabs', 'content rightPanel']`, więc `page/filters/` u niego nie istnieje. Filtr jest częścią stałą page'a wg [pages.md §2](./pages.md#2-filtry-filter); brak filtra to dług tej strony, nie osobna konwencja do naśladowania.
- `identity/permissions` nie ma `components/` — żaden z jego komponentów nie wychodzi poza stronę, więc wszystkie leżą w `page/content/`. To poprawny wynik reguły z §2, nie brak.

---

## Zobacz też

- [Architektura frontendu](./architecture.md) — podział na 5 warstw modułu i granice między nimi (co w ogóle wolno importować z `feature`)
- [Page dla agregatu](./pages.md) — zawartość plików z `page/`
- [Smart tabele](./smart-tables.md) — zawartość `components/tables/`
- [Modale](./modals.md) — zawartość `modal/`
- [Tłumaczenia](./translations.md) — zawartość `translation/`
- [Nowy moduł](./new-module.md) — jak powstaje biblioteka `feature`, w której to drzewo mieszka
