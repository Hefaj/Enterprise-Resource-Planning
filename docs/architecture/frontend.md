---
id: architecture.frontend
title: Architektura frontendu
summary: Architektura frontendu Angular NX, Native Federation i pięciu warstw modułów.
kind: architecture
scope: frontend
audience:
  - frontend
  - agent
triggers:
  - architektura frontendu
  - Native Federation lub granice bibliotek Nx
related: []
---

# Architektura frontendu

Frontend to **Angular NX Monorepo** złożony z mikrofrontendów spinanych przez **Native Federation** (federacja modułów oparta o natywne ESM przeglądarki i Esbuild — nie mylić z Webpack Module Federation, mimo podobnego API). Ten dokument opisuje, jak to jest poukładane i dlaczego — skrócona wersja jest wciągnięta wprost do [`CLAUDE.md`](../../CLAUDE.md) (sekcja "Architektura").

---

## 1. Host i moduły — jak to się spina w przeglądarce

Aplikacja składa się z jednego **hosta** i kilku **remote'ów**, każdy jako osobna aplikacja Angular, osobno budowana i serwowana:

| Aplikacja | Rola | Port |
|---|---|---|
| `client` | Host — powłoka, routing najwyższego poziomu, layout | 4200 |
| `catalog` | Remote — moduł katalogu produktów | 4201 |
| `inventory` | Remote — moduł magazynu | 4202 |
| `sales` | Remote — moduł sprzedaży | 4203 |
| `dms` | Remote — zarządzanie dokumentami | 4204 |
| `task-management` | Remote — zarządzanie zadaniami | 4205 |
| `notification` | Remote — powiadomienia | 4206 |
| `identity` | Remote — użytkownicy, role, uprawnienia | 4207 |

Kolejny nowy moduł dostaje pierwszy wolny port od 4208 wzwyż.

Host **nie zna** remote'ów w czasie kompilacji — dowiaduje się o nich w runtime, z manifestu. Dzięki temu każdy moduł da się wdrożyć, przebudować i wersjonować niezależnie od reszty; host tylko je ładuje.

### Sekwencja startu

1. Przeglądarka ładuje `client` (host) na porcie 4200.
2. `main.ts` hosta wywołuje `initFederation('/module-federation.manifest.json')` — pobiera manifest z adresami remotów i ich plikami `remoteEntry.json` (opis tego, co dany remote eksponuje).
3. Po zainicjalizowaniu federacji następuje dynamiczny import `bootstrap.ts` i `bootstrapApplication(App, appConfig)`.
4. `STARTUP.ts` (`APP_INITIALIZER`) odpytuje **każdy aktywny remote** o jego moduł `./contract` (przez `loadRemoteModule()`) i rejestruje z niego pozycje menu oraz identyfikatory modali — zanim użytkownik zobaczy pierwszy ekran, host już wie, jakie menu pokazać.
5. Routing hosta (`@erp/client/contract`, plik `app.routes.ts`) leniwie ładuje trasy poszczególnych modułów przez `loadRemoteModule()` — kod modułu ściąga się dopiero, gdy użytkownik faktycznie wejdzie na jego trasę.

Efekt: host startuje bez znajomości logiki biznesowej żadnego modułu — zna tylko manifest i kontrakt (`contract`), który każdy moduł musi wyeksponować.

### Trzy drogi po zawartość remota

Host sięga po kod remota na trzy sposoby — każdy dla innego rodzaju zawartości:

| Droga | Co przynosi | Mechanizm | Kiedy się ładuje |
|---|---|---|---|
| `remoteRoutes` | Całe ekrany pod własnym adresem | `app.routes.ts` + `loadRemoteModule()` | Przy wejściu na trasę modułu |
| `registerModals` / `remoteModalIds` | Modale otwierane z dowolnego miejsca | `ErpModalService.open(queueID, …)` | Przy pierwszym otwarciu danego modalu |
| **Rejestr widżetów** | Komponenty osadzane w layoucie HOSTA | `ErpWidgetRegistryService` | Przy pierwszym użyciu widżetu |

Trzecia droga powstała dla listy zadań masowych pod dzwonkiem powiadomień: to komponent modułu `notification`, ale renderuje się w nagłówku hosta — nie jest więc ani trasą, ani modalem.

Działa tak samo jak modale: `STARTUP.ts` (jedyna warstwa, która może zależeć od `contract`) rejestruje **funkcję ładującą**, a shell prosi o widżet po identyfikatorze, nic nie wiedząc o module, z którego on pochodzi. Kontrakt remota eksponuje funkcję zwracającą klasę komponentu i **providery swojego modułu** (`entry.widgets.ts`); rejestr buduje z nich child injector, żeby scope tłumaczeń remota nie przesłonił scope'ów pozostałych modułów.

Wszystko idzie przez `import()` wewnątrz funkcji — statyczny re-eksport komponentu z `contract` wciągnąłby warstwę `feature` do bundla ładowanego przy STARTUP, dla ekranu, którego użytkownik może nigdy nie otworzyć.

---

## 2. Struktura katalogów

```
frontend/
├── apps/
│   ├── client/                              # HOST (port 4200)
│   │   ├── public/module-federation.manifest.json  # rejestr remotów
│   │   ├── src/main.ts                      # initFederation → bootstrap
│   │   ├── src/bootstrap.ts                 # bootstrapApplication(App, appConfig)
│   │   ├── src/app/app.config.ts            # providery, router
│   │   ├── src/app/STARTUP.ts               # APP_INITIALIZER — ładuje menu z remotów
│   │   ├── federation.config.mjs            # co host współdzieli/pomija
│   │   └── vite.config.mts
│   │
│   └── modules/
│       ├── catalog/  inventory/  sales/  dms/  task-management/  notification/  identity/
│       │   └── (każdy: src/main.ts, main.mfe.ts, federation.config.mjs)
│
└── libs/
    ├── client/                # biblioteki specyficzne dla hosta
    │   ├── contract/          # routing hosta, REMOTE_MODULES_CONFIG
    │   ├── feature/           # ShellLayout, Dashboard, Settings
    │   ├── ui/  util/
    │
    ├── shared/                 # scope:shared — dostępne z każdego modułu
    │   ├── ui/                 # komponenty TaigaUI / atomy wspólne
    │   ├── auth/                # guardy, serwisy auth
    │   └── data-access/         # BaseOrchestrator, IdentityMapStore, DataLoader, SignalR sync
    │
    └── modules/
        └── MODULE_NAME/
            ├── contract/       # routing + menu modułu, eksponowane przez Native Federation
            ├── feature/        # smart components, RemoteEntry, strony
            ├── ui/              # dumb komponenty prezentacyjne
            ├── data-access/     # API clients (NSwag), orkiestratory, Signal Stores
            └── util/            # helpery, modele, stałe
```

---

## 3. Pięć warstw modułu

Każdy moduł biznesowy (`libs/modules/MODULE_NAME/`) dzieli się na 5 bibliotek. Podział nie jest umowny — jest **wymuszony przez ESLint** (`@nx/enforce-module-boundaries`), więc próba importu w złą stronę wywala build, nie tylko code review.

| Warstwa | Tag NX | Rola | Może importować |
|---|---|---|---|
| `contract` | `type:contract` | Routing (`remoteRoutes`), menu (`remoteMenu`), definicje modali. Jedyna warstwa eksponowana bezpośrednio przez Native Federation. | `feature`, `ui`, `auth`, `data-access`, `util`, `env` |
| `feature` | `type:feature` | Smart components — logika, wstrzykiwanie serwisów, `RemoteEntry`. | `ui`, `data-access`, `util` |
| `ui` | `type:ui` | Prezentacyjne (dumb) komponenty TaigaUI — tylko `@Input`/`@Output`, zero serwisów. | `ui`, `util` |
| `data-access` | `type:data-access` | Klienci HTTP (NSwag), orkiestratory, Signal Stores. | `data-access`, `util` |
| `util` | `type:util` | Helpery, modele, stałe — zero zależności od Angulara poza typami. | `util` |

Kierunek zależności jest jednokierunkowy i zbiega się w `util`:

```
contract → feature → ui → util
              ↓        ↑
         data-access ──┘
```

`ui` **nigdy** nie zna `data-access` — komponent prezentacyjny dostaje dane przez `@Input`, nie wstrzykuje orkiestratora. To jest granica smart/dumb: jeśli komponent w `ui` chce wstrzyknąć serwis danych, to znak, że powinien być w `feature`.

### Tagi NX

Każdy projekt ma dwa tagi:

- **`scope:MODULE_NAME`** — domena (`scope:catalog`, `scope:shared`, `scope:host`...). `scope:X` może importować tylko z `scope:shared` i `scope:X` — moduły nie widzą się nawzajem.
- **`type:WARSTWA`** — warstwa techniczna z tabeli wyżej.

`scope:shared` importuje tylko z `scope:shared`. Dzięki temu biblioteka współdzielona nigdy nie może przypadkiem zaciągnąć czegoś specyficznego dla jednego modułu.

### Aliasy TS

`@erp/MODULE_NAME/WARSTWA`, np. `@erp/catalog/feature`, `@erp/shared/data-access`. Każda biblioteka eksponuje tylko to, co jest w jej `index.ts` (public API) — reszta jest prywatna dla biblioteki.

---

## 4. Native Federation — współdzielenie zależności i HMR

`federation.config.mjs` (osobny w hoście i w każdym remote'cie) decyduje, co jest `shared` (jedna kopia w runtime, dzielona między hostem a remote'ami) a co jest bundlowane inline z każdą aplikacją osobno.

Domyślnie `shareAll()` rejestruje **wszystkie** biblioteki workspace'u jako `shared` — łącznie z wewnętrznymi bibliotekami modułu (`@erp/catalog/feature`, `@erp/catalog/data-access`, itd.). To ma kosztowny efekt uboczny: Native Federation pre-bundluje je do osobnych plików (np. `_erp_catalog_feature.js`), które **nie są objęte Vite HMR** — zmiana w takiej bibliotece nie odświeży się w przeglądarce, trzeba ręcznie restartować dev server.

**Dlatego** każdy moduł musi jawnie dodać swoje **własne** wewnętrzne biblioteki do tablicy `skip` w `federation.config.mjs` — wtedy trafiają do bundla inline i HMR działa normalnie.

| Biblioteka | Shared? | HMR? | Uzasadnienie |
|---|---|---|---|
| `@erp/MODULE_NAME/{feature,data-access,ui,util}` | ❌ `skip` | ✅ tak | Używane tylko przez ten jeden moduł — nie ma sensu ich współdzielić między aplikacjami |
| `@erp/client/{feature,contract,ui,util}` | ❌ `skip` | ✅ tak | Używane tylko przez hosta |
| `@erp/shared/*` | ✅ shared | ❌ nie | Współdzielone między hostem i wszystkimi remote'ami — restart wymagany po zmianie |
| `@angular/*`, `rxjs`, `@taiga-ui/*` | ✅ shared | ❌ nie | Zależności zewnętrzne — jedna kopia w runtime dla wszystkich aplikacji |

Konsekwencja praktyczna: jeśli edytujesz coś w `libs/shared/**` i zmiana się nie pojawia, to nie bug — zrestartuj dev server. Jeśli edytujesz coś w `libs/modules/MODULE_NAME/**` i HMR nie działa, sprawdź najpierw, czy ta biblioteka faktycznie jest w `skip` w `federation.config.mjs` tego modułu.

---

## 5. Konwencje

- **Standalone Components** domyślnie — bez `NgModule`.
- **Signal-based state** — preferowane nad `Observable` + ręczna subskrypcja w nowym kodzie; przy refaktorze starego kodu migruj Observable → Signals.
- **Control Flow**: `@if`, `@for`, `@switch` — nie stare `*ngIf`/`*ngFor`.
- **TaigaUI v5+** to główna biblioteka komponentów UI. Nie zakładaj PrimeNG, chyba że kod legacy już go używa albo user explicite o to poprosi.
- **Styling**: Tailwind CSS v4 do layoutu/spacingu/ogólnego stylowania + zmienne `--tui-*` / design tokens TaigaUI tam, gdzie Tailwind nie sięga (stylowanie wnętrza komponentów TaigaUI).
- **Selektory**: `erp-*` w bibliotekach (`libs/`), `app-*` w aplikacjach (`apps/`).
- **Package manager**: pnpm. Nie modyfikuj `package-lock.json` ani `node_modules` ręcznie.
- Przed utworzeniem nowej biblioteki sprawdź, czy istniejąca może hostować komponent — nie mnóż bibliotek bez potrzeby.

---

## 6. Powiązane dokumenty

- [Nowy moduł](../guides/frontend/new-module.md) — jak powstaje moduł opisany wyżej, krok po kroku.
- [Struktura `feature`](../guides/frontend/feature-structure.md) → [Page dla agregatu](../guides/frontend/pages.md) → [Smart tabele](../guides/frontend/smart-tables.md) → [Zasięg zaznaczenia](../guides/frontend/selection-scope.md) — ścieżka od katalogu do gotowego ekranu listy.
- [Orkiestratory (`data-access`)](../guides/frontend/orchestrators.md) — jak moduły pobierają, cache'ują i wzbogacają dane agregatów.
- [Modale](../guides/frontend/modals.md), [Atomy UI](../guides/frontend/atoms.md), [Tłumaczenia](../guides/frontend/translations.md) — pozostałe przepisy zadaniowe, zaindeksowane w [`CLAUDE.md`](../../CLAUDE.md).
- [Podział na strony w DMS](../modules/dms/screens.md) — 📐 projekt; przykład rozpisania całego modułu na ekrany, razem z modelem domenowym w [`dms-workflow.md`](../modules/dms/domain-workflow.md).
- Backend: [architektura](backend.md), [uprawnienia i bramkowanie UI](security.md).
- Praca z komponentami TaigaUI: [`.agents/skills/taiga-ui/SKILL.md`](../../.agents/skills/taiga-ui/SKILL.md).
