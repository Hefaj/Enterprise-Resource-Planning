# Plan realizacji — uporządkowanie dokumentacji technicznej i dokumentacja użytkownika

> **Rodzaj dokumentu:** aktywny plan implementacji
> **Data utworzenia:** 03.09.2026
> **Status:** completed — 04.09.2026
> **Zakres:** reorganizacja `docs/`, uporządkowanie planów implementacji, automatyczne indeksowanie oraz wspólna strona dokumentacji użytkownika dla modułów ERP
> **Poza zakresem tego pliku:** implementacja nowych funkcji biznesowych modułów oraz pełny refaktor wizualny Task Management

---

## 0. Cel i rezultat końcowy

Po wykonaniu tego planu repozytorium ma dwa rozdzielone systemy dokumentacji:

1. **Dokumentacja techniczna w `docs/`** — opisuje aktualne założenia, decyzje, architekturę,
   powtarzalne przepisy implementacyjne i techniczną specyfikację modułów. Nie zawiera dzienników
   wykonania ani jednorazowych planów realizacji.
2. **Dokumentacja użytkownika dostarczana z modułami Angular** — opisuje możliwości modułu,
   przebiegi pracy, wymagane uprawnienia, ograniczenia i typowe problemy. Jest dostępna jako
   strona w aplikacji i przeszukiwalna lokalnie oraz globalnie.

Plany jednorazowej implementacji żyją poza `docs/`:

```text
plans/
├── README.md
├── active/                 # aktualnie wykonywane plany
├── backlog/                # zaakceptowane plany oczekujące na realizację
└── archive/                # zakończone plany zachowane jako historia projektu
```

Docelowy przepływ informacji:

```text
decyzja / standard techniczny ───────────────► docs/
jednorazowa kolejność wdrożenia ─────────────► plans/
działająca funkcja widoczna dla użytkownika ─► dokumentacja modułu Angular
                                               │
                                               ├─► strona modułu
                                               ├─► pomoc kontekstowa
                                               └─► globalne wyszukiwanie /help
```

---

## 1. Zasady wiążące

### 1.1 Granice treści

| Rodzaj informacji | Miejsce | Przykład |
|---|---|---|
| Architektura całego systemu | `docs/architecture/` | Native Federation, Clean Architecture, outbox |
| Powtarzalny przepis techniczny | `docs/guides/` | nowy modal, nowa komenda CQRS, nowy page |
| Techniczna specyfikacja domeny | `docs/modules/MODULE/` | agregaty i reguły Task Management |
| Operacje produkcyjne | `docs/operations/` | wdrożenie, health checks, backup |
| Dane referencyjne | `docs/reference/` | mapa portów, mapa repozytorium |
| Uzasadnienie istotnej decyzji | `docs/decisions/` | ADR dotyczący wyboru magazynu plików |
| Jednorazowy plan wdrożenia | `plans/active/` lub `plans/backlog/` | fazy rozwoju Task Management |
| Historia zakończonej implementacji | `plans/archive/` i Git | zakończony plan eksportów |
| Instrukcja dla użytkownika ERP | kod danego modułu `feature/documentation/` | jak utworzyć zgłoszenie |

Powtarzalna checklista, np. „jak utworzyć nowy moduł”, jest dokumentacją techniczną, a nie planem.
Planem jest tylko kolejność wykonania konkretnej, jednorazowej zmiany w tym repozytorium.

### 1.2 Zasada aktualnego stanu

- Dokumentacja techniczna opisuje rozwiązanie aktualne albo jawnie oznaczoną specyfikację docelową.
- Numer fazy, dziennik sesji, lista wykonanych commitów i opis ręcznego przeklikania należą do planu
  lub historii Git, nie do dokumentu architektonicznego.
- Dokumentacja użytkownika pokazuje wyłącznie funkcje dostępne z UI i zweryfikowane end-to-end.
- Sam endpoint, klasa domenowa, pozycja menu albo przycisk z `console.log` nie jest dowodem, że
  funkcjonalność nadaje się do opisania jako dostępna.
- Nie generujemy automatycznie prozy użytkowej z kodu. Automatyzujemy indeksy, strukturę,
  walidację kompletności i powiązania z funkcjami.

### 1.3 Ochrona bieżących zmian

W chwili utworzenia tego planu worktree zawiera niezależne, niezacommitowane zmiany Task Management.
Realizacja musi:

- zaczynać każdą fazę od `git status --short`;
- nie modyfikować równolegle plików aktualnie zmienianych przez inny plan;
- dzielić pracę na małe, tematyczne commity;
- nie używać `git reset --hard`, `git checkout --` ani innych operacji kasujących cudzą pracę;
- wykonywać integrację Task Management dopiero po ustaleniu stabilnego punktu bieżącego planu.

---

## 2. Stan wejściowy i problemy do rozwiązania

### 2.1 Plany implementacji

W root repozytorium istnieją dwa plany:

| Plik | Stan | Docelowe działanie |
|---|---|---|
| `PLAN-task-management.md` | aktywny | przenieść do `plans/active/task-management.md` |
| `PLAN.md` | zakończony; sam wskazuje, że można go usunąć | po audycie trwałej wiedzy przenieść do `plans/archive/2026-08-endpoint-naming-exports-notifications.md` |

Kod produkcyjny i testy zawierają odwołania do `PLAN-task-management.md`. Docelowo komentarz w kodzie
nie powinien zależeć od aktywnego planu. Każde takie odwołanie trzeba zastąpić odwołaniem do trwałego
dokumentu technicznego, a dopiero potem przenieść plan.

### 2.2 Dokumentacja techniczna

Problemy stanu wejściowego:

- `docs/README.md` nie indeksuje całej zawartości `docs/`;
- dokumenty są podzielone tylko na `frontend/` i `backend/`, mimo że część z nich opisuje moduły,
  operacje lub rozwiązania przekrojowe;
- dokumenty Task Management i DMS łączą model domenowy, układ ekranów i kolejność wdrażania;
- ręcznie utrzymywany stan implementacji już rozjeżdża się z kodem;
- nie istnieje techniczny indeks modułu Catalog;
- `AGENTS.md`, `CLAUDE.md` i `docs/README.md` powielają ręcznie listy dokumentów;
- nie ma automatycznej walidacji linków, anchorów, metadanych ani dokumentów osieroconych.

### 2.3 Dokumentacja użytkownika

Nie istnieje wspólny model artykułu, layout strony, manifest treści, indeks wyszukiwania ani kontrakt
remota dla globalnej pomocy. Nie ma też reguły Definition of Done wymagającej aktualizacji instrukcji
po dodaniu funkcji biznesowej.

---

## 3. Docelowe drzewo dokumentacji technicznej

```text
docs/
├── README.md
├── architecture/
│   ├── README.md
│   ├── system-overview.md
│   ├── frontend.md
│   ├── backend.md
│   ├── security.md
│   ├── integration-events.md
│   ├── realtime.md
│   ├── multi-instance.md
│   └── reporting.md
├── guides/
│   ├── README.md
│   ├── frontend/
│   │   ├── README.md
│   │   ├── new-module.md
│   │   ├── feature-structure.md
│   │   ├── pages.md
│   │   ├── smart-tables.md
│   │   ├── selection-scope.md
│   │   ├── modals.md
│   │   ├── atoms.md
│   │   ├── orchestrators.md
│   │   ├── optimistic-updates.md
│   │   ├── translations.md
│   │   ├── notifications.md
│   │   ├── multimedia.md
│   │   └── user-directory.md
│   └── backend/
│       ├── README.md
│       ├── new-microservice.md
│       ├── cqrs.md
│       ├── endpoint-naming.md
│       ├── bulk-commands.md
│       ├── batch-validation.md
│       ├── persistence-ef.md
│       ├── exports-artifacts.md
│       └── media-storage.md
├── modules/
│   ├── README.md
│   ├── catalog/
│   │   ├── README.md
│   │   └── architecture.md
│   ├── task-management/
│   │   ├── README.md
│   │   ├── domain.md
│   │   ├── requirements.md
│   │   └── screens.md
│   ├── dms/
│   │   ├── README.md
│   │   ├── domain-workflow.md
│   │   └── screens.md
│   └── notification/
│       ├── README.md
│       └── user-notifications.md
├── operations/
│   ├── README.md
│   ├── production.md
│   └── observability.md
├── reference/
│   ├── README.md
│   ├── repository-map.md
│   ├── ports.md
│   └── glossary.md
├── decisions/
│   └── README.md
└── contributing/
    ├── README.md
    └── documentation.md
```

`docs/decisions/` nie wymaga natychmiastowego przepisywania wszystkich historycznych decyzji na ADR.
Powstaje jako miejsce dla przyszłych decyzji, których nie da się czytelnie utrzymać wyłącznie w
dokumencie architektonicznym.

---

## 4. Mapa przeniesień istniejących dokumentów

Przeniesienia wykonać przez `git mv`, żeby Git zachował historię plików.

### 4.1 Architektura

| Obecnie | Docelowo |
|---|---|
| `docs/architecture/frontend.md` | `docs/architecture/frontend.md` |
| `docs/architecture/backend.md` | `docs/architecture/backend.md` |
| `docs/architecture/security.md` | `docs/architecture/security.md` |
| `docs/architecture/integration-events.md` | `docs/architecture/integration-events.md` |
| `docs/architecture/realtime.md` | `docs/architecture/realtime.md` |
| `docs/architecture/multi-instance.md` | `docs/architecture/multi-instance.md` |
| `docs/architecture/reporting.md` | `docs/architecture/reporting.md` |

### 4.2 Przepisy frontendowe

| Obecnie | Docelowo |
|---|---|
| `docs/guides/frontend/new-module.md` | `docs/guides/frontend/new-module.md` |
| `docs/guides/frontend/feature-structure.md` | `docs/guides/frontend/feature-structure.md` |
| `docs/guides/frontend/pages.md` | `docs/guides/frontend/pages.md` |
| `docs/guides/frontend/smart-tables.md` | `docs/guides/frontend/smart-tables.md` |
| `docs/guides/frontend/selection-scope.md` | `docs/guides/frontend/selection-scope.md` |
| `docs/guides/frontend/modals.md` | `docs/guides/frontend/modals.md` |
| `docs/guides/frontend/atoms.md` | `docs/guides/frontend/atoms.md` |
| `docs/guides/frontend/orchestrators.md` | `docs/guides/frontend/orchestrators.md` |
| `docs/guides/frontend/optimistic-updates.md` | `docs/guides/frontend/optimistic-updates.md` |
| `docs/guides/frontend/translations.md` | `docs/guides/frontend/translations.md` |
| `docs/guides/frontend/notifications.md` | `docs/guides/frontend/notifications.md` |
| `docs/guides/frontend/multimedia.md` | `docs/guides/frontend/multimedia.md` |
| `docs/guides/frontend/user-directory.md` | `docs/guides/frontend/user-directory.md` |

### 4.3 Przepisy backendowe

| Obecnie | Docelowo |
|---|---|
| `docs/guides/backend/new-microservice.md` | `docs/guides/backend/new-microservice.md` |
| `docs/guides/backend/cqrs.md` | `docs/guides/backend/cqrs.md` |
| `docs/guides/backend/endpoint-naming.md` | `docs/guides/backend/endpoint-naming.md` |
| `docs/guides/backend/bulk-commands.md` | `docs/guides/backend/bulk-commands.md` |
| `docs/guides/backend/batch-validation.md` | `docs/guides/backend/batch-validation.md` |
| `docs/guides/backend/persistence-ef.md` | `docs/guides/backend/persistence-ef.md` |
| `docs/guides/backend/exports-artifacts.md` | `docs/guides/backend/exports-artifacts.md` |
| `docs/guides/backend/media-storage.md` | `docs/guides/backend/media-storage.md` |

### 4.4 Dokumenty modułowe

| Obecnie | Docelowo |
|---|---|
| `docs/modules/task-management/domain.md` | `docs/modules/task-management/domain.md` |
| `docs/modules/task-management/requirements.md` | `docs/modules/task-management/requirements.md` |
| `docs/modules/task-management/screens.md` | `docs/modules/task-management/screens.md` |
| `docs/modules/dms/domain-workflow.md` | `docs/modules/dms/domain-workflow.md` |
| `docs/modules/dms/screens.md` | `docs/modules/dms/screens.md` |
| `docs/modules/notification/user-notifications.md` | `docs/modules/notification/user-notifications.md` |

### 4.5 Operacje

| Obecnie | Docelowo |
|---|---|
| `docs/operations/production.md` | `docs/operations/production.md` |
| `docs/operations/observability.md` | `docs/operations/observability.md` |

Po migracji katalogi `docs/frontend/` i `docs/backend/` mają zostać usunięte, jeśli będą puste.
Nie pozostawiamy stubów przekierowujących — wszystkie odwołania w repozytorium aktualizujemy w tej
samej fazie.

---

## 5. Treść do oddzielenia od dokumentacji technicznej

Przed przeniesieniem plików należy przejrzeć wskazane sekcje i przenieść jednorazowe plany do
`plans/`, zostawiając w `docs/` wyłącznie regułę lub rozwiązanie obowiązujące po wdrożeniu.

| Dokument wejściowy | Treść wymagająca rozdzielenia |
|---|---|
| `docs/architecture/backend.md` | ręcznie utrzymywana tabela stanu wdrożenia i sekcje „co zostaje otwarte” |
| `docs/modules/task-management/domain.md` | „kolejność wdrożenia” oraz odwołania do faz |
| `docs/modules/task-management/requirements.md` | kolumny `Faza`/`Stan`, tabela faz MVP i dziennik postępu |
| `docs/modules/task-management/screens.md` | opis faz zamiast aktualnych możliwości ekranów |
| `docs/modules/dms/domain-workflow.md` | jednorazowa kolejność wdrożenia DMS |
| `docs/modules/dms/screens.md` | fazowanie przyszłych ekranów DMS |
| `docs/modules/notification/user-notifications.md` | jednorazowa kolejność wdrożenia |
| `docs/operations/production.md` | plan pierwszego uruchomienia oddzielić od trwałego runbooka |
| `docs/operations/observability.md` | kolejność wdrożenia oddzielić od docelowych metryk i alertów |
| `docs/architecture/reporting.md` | status projektowy oddzielić od architektury raportowania |

Jeżeli dana funkcjonalność nadal nie istnieje, dokument techniczny może ją opisywać jako
`specification`, ale nie może sugerować, że jest dostępna. Jednorazowe kroki realizacji trafiają do:

```text
plans/backlog/dms.md
plans/backlog/production.md
plans/backlog/observability.md
plans/backlog/notification.md
```

Plik backlogu tworzymy tylko wtedy, gdy po usunięciu treści planistycznej pozostają konkretne,
zaakceptowane kroki do wykonania. Nie tworzymy pustych planów „na przyszłość”.

---

## 6. Metadane i automatyczne indeksowanie dokumentacji technicznej

### 6.1 Front matter

Każdy trwały dokument w `docs/`, poza generowanymi indeksami, otrzymuje front matter:

```yaml
---
id: frontend.pages
title: Page dla agregatu
summary: Szkielet strony z filtrem, treścią i opcjonalnym panelem zależnym od zaznaczenia.
kind: guide
scope: frontend
audience:
  - frontend
  - agent
triggers:
  - nowy page dla agregatu
  - panel zależny od zaznaczenia
related:
  - frontend.smart-tables
  - frontend.selection-scope
---
```

Dozwolone `kind`:

- `overview`;
- `architecture`;
- `guide`;
- `module-specification`;
- `operations`;
- `reference`;
- `decision`;
- `contributing`.

Metadane nie zawierają ręcznie aktualizowanej daty ani procentu wykonania. Historia zmian jest w Git.

### 6.2 Narzędzia

Utworzyć:

```text
tools/scripts/documentation/
├── documentation-schema.mjs
├── read-front-matter.mjs
├── scan-technical-docs.mjs
├── generate-technical-index.mjs
├── validate-technical-docs.mjs
├── generate-user-documentation.mjs
├── validate-user-documentation.mjs
└── scaffold-user-article.mjs
```

Do parsowania YAML zadeklarować bezpośrednią zależność developerską, zamiast polegać na zależności
przechodniej:

```bash
pnpm add -D yaml
```

`markdown-it` jest już bezpośrednią zależnością repozytorium i może zostać wykorzystany przez
generator dokumentacji użytkownika.

### 6.3 Skrypty `package.json`

Dodać:

```json
{
  "docs:generate:technical": "node tools/scripts/documentation/generate-technical-index.mjs",
  "docs:generate:user": "node tools/scripts/documentation/generate-user-documentation.mjs",
  "docs:generate": "pnpm docs:generate:technical && pnpm docs:generate:user",
  "docs:check:technical": "node tools/scripts/documentation/validate-technical-docs.mjs",
  "docs:check:user": "node tools/scripts/documentation/validate-user-documentation.mjs",
  "docs:check": "pnpm docs:check:technical && pnpm docs:check:user",
  "docs:scaffold": "node tools/scripts/documentation/scaffold-user-article.mjs"
}
```

Generatory muszą wspierać `--check`: generują wynik do pamięci lub katalogu tymczasowego i porównują
go z plikami w repozytorium. Nie mogą opierać poprawności na czystym `git diff`, ponieważ developer
może pracować w brudnym worktree.

### 6.4 Co generujemy

- sekcje tabelaryczne w `docs/README.md`;
- indeksy `README.md` dla `architecture`, `guides`, `modules`, `operations` i `reference`;
- ograniczony blok „Przepisy zadaniowe” w `AGENTS.md` i `CLAUDE.md`, między jednoznacznymi markerami;
- raport dokumentów bez linków przychodzących;
- mapę `id → ścieżka`, używaną do walidacji `related`;
- kontrolę linków względnych i anchorów nagłówków.

Generator modyfikuje wyłącznie oznaczone bloki:

```markdown
<!-- generated:documentation-index:start -->
...
<!-- generated:documentation-index:end -->
```

Pozostała treść `AGENTS.md` i `CLAUDE.md` musi pozostać nietknięta.

### 6.5 Walidacje techniczne

`docs:check:technical` kończy się błędem, gdy:

- brakuje wymaganego pola metadanych;
- `id` nie jest unikalne;
- `related` wskazuje nieznany dokument;
- link względny wskazuje nieistniejący plik;
- anchor nie istnieje w dokumencie docelowym;
- dokument nie jest osiągalny z żadnego indeksu i nie ma `kind: decision`;
- plik z `plans/` został podlinkowany jako trwałe źródło reguły z kodu produkcyjnego;
- w `docs/` pojawił się dokument `kind: plan` albo dziennik sesji;
- wygenerowany indeks jest nieaktualny.

---

## 7. Porządkowanie planów implementacji

### 7.1 Utworzenie katalogów i indeksu

- [x] Utworzyć `plans/README.md`.
- [x] Utworzyć `plans/active/`, `plans/backlog/`, `plans/archive/`.
- [x] W `plans/README.md` opisać cykl życia planu: backlog → active → archive.
- [x] Zaznaczyć, że zakończony plan nie jest źródłem trwałych reguł architektonicznych.

### 7.2 Trwała wiedza cytowana z planu Task Management

Przed zmianą ścieżki wyszukać wszystkie odwołania:

```bash
rg -n 'PLAN-task-management\.md|PLAN\.md' . \
  --glob '!node_modules/**' \
  --glob '!**/bin/**' \
  --glob '!**/obj/**'
```

Dla każdego komentarza w kodzie:

1. określić, jaka reguła jest cytowana;
2. upewnić się, że reguła istnieje w trwałym dokumencie modułu lub przewodniku;
3. jeśli nie istnieje — dopisać ją do odpowiedniego dokumentu technicznego;
4. zmienić komentarz tak, aby odwoływał się do dokumentu technicznego, nie do planu;
5. pozostawić komentarz bez linku, jeżeli kod jest wystarczająco samowyjaśniający.

Dotyczy co najmniej:

- testów uprawnienia raportowego;
- testów burndownu sprintu;
- katalogu uprawnień;
- reaktywności tłumaczeń strony raportu;
- parsera warunków automatyzacji;
- indeksu i pomiaru zapytania dla konfiguracji `Issue`.

### 7.3 Przeniesienie

- [x] `git mv PLAN-task-management.md plans/active/task-management.md`.
- [x] Zaktualizować odwołania w dokumentach technicznych do nowej ścieżki planu tylko tam, gdzie
      dokument świadomie wskazuje plan jako plan.
- [x] Zweryfikować, że kod produkcyjny nie cytuje aktywnego planu jako źródła reguły.
- [x] Przejrzeć `PLAN.md` i potwierdzić, że trwałe decyzje znajdują się w dokumentach o endpointach,
      artefaktach i powiadomieniach.
- [x] `git mv PLAN.md plans/archive/2026-08-endpoint-naming-exports-notifications.md`.
- [x] Uzupełnić nagłówek zarchiwizowanego planu o status `completed` bez przepisywania jego historii.
- [x] Sprawdzić stare odwołania przez `rg`, wykluczając ten plan i archiwum. Po ręcznej klasyfikacji
      nie może zostać żadne aktywne odwołanie do dawnej ścieżki.

Plan `plans/active/documentation-organization.md` po zakończeniu wszystkich faz zostaje przeniesiony do
`plans/archive/2026-09-documentation-organization.md`.

---

## 8. Wspólny model dokumentacji użytkownika

### 8.1 Lokalizacja i warstwy NX

Nie tworzymy szóstej biblioteki każdego modułu. Dokumentacja jest funkcją frontendową i mieści się
w istniejącej warstwie `feature`.

Typy niezależne od Angulara:

```text
frontend/libs/shared/util/src/lib/documentation/
├── documentation.types.ts
├── documentation-slug.utils.ts
└── index.ts
```

Komponenty prezentacyjne:

```text
frontend/libs/shared/ui/src/lib/
├── organisms/erp-documentation-layout/
│   ├── erp-documentation-layout.types.ts
│   ├── erp-documentation-layout.builder.ts
│   ├── erp-documentation-layout.component.ts
│   └── index.ts
└── molecules/
    ├── erp-documentation-article/
    │   ├── erp-documentation-article.types.ts
    │   ├── erp-documentation-article.builder.ts
    │   ├── erp-documentation-article.component.ts
    │   └── index.ts
    └── erp-documentation-search/
        ├── erp-documentation-search.types.ts
        ├── erp-documentation-search.builder.ts
        ├── erp-documentation-search.component.ts
        └── index.ts
```

Rejestr loaderów indeksów remotów:

```text
frontend/libs/shared/data-access/src/lib/documentation/
├── documentation-registry.service.ts
├── documentation-search.service.ts
└── index.ts
```

Globalna strona hosta:

```text
frontend/libs/client/feature/src/lib/component/help/
├── help.component.ts
├── help.store.ts
└── translation/
```

### 8.2 Główne typy

Model w `shared/util` ma obejmować co najmniej:

```typescript
export interface ErpDocumentationModuleDescriptor {
  readonly moduleId: string;
  readonly routePrefix: string;
  readonly overviewArticleId: string;
  readonly requiredPermission?: string;
}

export interface ErpDocumentationArticleDescriptor {
  readonly id: string;
  readonly slug: string;
  readonly parentId?: string;
  readonly order: number;
  readonly icon?: string;
  readonly relatedArticleIds?: readonly string[];
  readonly contextRoutes?: readonly string[];
  readonly capabilityIds?: readonly string[];
  readonly requiredPermission?: string;
}

export interface ErpDocumentationArticle {
  readonly id: string;
  readonly locale: 'pl-PL' | 'en-US';
  readonly title: string;
  readonly summary: string;
  readonly html: string;
  readonly headings: readonly ErpDocumentationHeading[];
}

export interface ErpDocumentationSearchEntry {
  readonly moduleId: string;
  readonly articleId: string;
  readonly locale: 'pl-PL' | 'en-US';
  readonly title: string;
  readonly summary: string;
  readonly headings: readonly string[];
  readonly normalizedText: string;
}
```

Dokładne typy ustalić testami kontraktowymi przed implementacją komponentów. `shared/util` nie może
importować Angulara, routera ani Taiga UI.

### 8.3 Struktura jednego modułu

Każdy moduł z dokumentacją otrzymuje:

```text
frontend/libs/modules/MODULE/feature/src/lib/documentation/
├── page/
│   ├── documentation.component.ts
│   └── documentation.store.ts
├── content/
│   ├── pl-PL/
│   │   ├── overview.md
│   │   └── ...
│   └── en-US/
│       ├── overview.md
│       └── ...
├── generated/
│   ├── documentation.pl-PL.generated.ts
│   ├── documentation.en-US.generated.ts
│   ├── documentation-search.pl-PL.generated.ts
│   └── documentation-search.en-US.generated.ts
├── documentation.manifest.json
└── index.ts
```

Pliki w `generated/` są wersjonowane tak samo jak `translation/keys.ts`, ale nigdy nie są edytowane
ręcznie. CI sprawdza ich aktualność.

Generator tworzy dodatkowo czysty rejestr identyfikatorów w warstwie `util`, dostępny zarówno dla
`feature`, jak i `contract`:

```text
frontend/libs/modules/MODULE/util/src/lib/documentation/
├── documentation-article-ids.generated.ts
└── index.ts
```

Dzięki temu route metadata używa typowanej stałej, a `contract` nie importuje statycznie `feature`,
które w tych samych trasach jest ładowane dynamicznie.

### 8.4 Format artykułu

Artykuł Markdown zawiera:

```markdown
# Tytuł

Krótki opis odpowiadający na pytanie „po co tego używać”.

## Kto może wykonać operację

## Gdzie znaleźć funkcję

## Jak wykonać operację

## Rezultat

## Ograniczenia i przypadki szczególne

## Powiązane tematy
```

Zasady:

- treść polska i angielska ma identyczne `articleId` i zestaw wymaganych sekcji;
- prose użytkowej nie umieszczamy w Transloco;
- Transloco obsługuje chrome strony: wyszukiwarkę, nawigację, komunikaty puste i etykiety przycisków;
- artykuł nie używa nazw klas, handlerów, endpointów, tabel bazy ani numerów faz;
- instrukcja zawiera wymagane uprawnienie w języku użytkownika, nie tylko kod uprawnienia;
- screenshot jest dodatkiem, nie jedynym nośnikiem instrukcji;
- każdy obraz ma tekst alternatywny;
- nie opisujemy przycisku, który jest atrapą albo prowadzi wyłącznie do `console.log`.

### 8.5 Renderowanie Markdown

Generator używa `markdown-it` w czasie budowania:

- `html: false` — surowy HTML z artykułu jest odrzucany;
- dozwolone protokoły linków: `https`, `http`, `mailto` oraz linki wewnętrzne dokumentacji;
- linki zewnętrzne dostają `rel="noopener noreferrer"`;
- nagłówki dostają stabilne, unikalne identyfikatory;
- z tokenów nagłówków powstaje spis treści;
- Angular renderuje wynik przez zwykłe `[innerHTML]`, bez `bypassSecurityTrustHtml`;
- komponent przechwytuje linki wewnętrzne i używa Angular Routera, żeby nie przeładowywać aplikacji;
- kod, tabele, listy, cytaty i obrazy otrzymują style oparte na tokenach Taiga UI.

Jeśli zwykłe `[innerHTML]` usunie wymagane bezpieczne atrybuty, nie wolno wyłączać sanitizacji.
Należy zmienić format wygenerowanego modelu albo renderer, a nie omijać zabezpieczenia.

---

## 9. Wspólne komponenty strony dokumentacji

### 9.1 `erp-documentation-layout`

Komponent jest prezentacyjny, żyje w `shared/ui`, przyjmuje jeden config zbudowany przez
`ErpDocumentationLayoutBuilder` i nie wstrzykuje serwisów modułu.

Desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ tytuł modułu                     wyszukiwarka                 │
├─────────────────┬─────────────────────────────┬──────────────┤
│ nawigacja       │ article                     │ na tej stronie│
│ tematów         │ max-width ok. 80 znaków     │ anchory       │
│                 │                             │               │
└─────────────────┴─────────────────────────────┴──────────────┘
```

Mobile/tablet:

- nawigacja tematów w drawerze;
- spis bieżącego artykułu jako rozwijana sekcja;
- wyszukiwarka na pełną szerokość;
- treść bez poziomego przewijania;
- przyciski poprzedni/następny pod artykułem.

Nie używać `erp-grid-layout`: jego semantyka i zapamiętywane resizowanie są przeznaczone dla stron
danych, filtrów i paneli zależnych od zaznaczenia, nie dla dokumentu czytanego od góry do dołu.

### 9.2 Ponowne użycie istniejących komponentów

W pierwszej kolejności użyć:

- `erp-button`;
- `erp-breadcrumb`;
- `erp-drawer`;
- `erp-empty-state`;
- `erp-scroll-viewport`;
- komponentów i dyrektyw Taiga UI v5.

`erp-tree` użyć tylko po potwierdzeniu, że jego model wyboru i obsługa klawiatury pasują do nawigacji.
Jeżeli wymaga obejść właściwych dla drzewa danych, zbudować prostą semantyczną nawigację dokumentacji
z `<nav>`, listami i `aria-current="page"`.

### 9.3 Dostępność

- [x] jeden `<main>` i jeden `<article>` na stronie;
- [x] logiczna hierarchia `h1 → h2 → h3`;
- [x] skip link do treści artykułu;
- [x] `aria-current="page"` dla aktywnego artykułu;
- [x] fokus przenoszony na `h1` po zmianie artykułu;
- [x] fragment URL przewija do nagłówka i ustawia fokus;
- [x] wyszukiwarka ma prawidłową etykietę, nie tylko placeholder;
- [x] pełna obsługa klawiatury bez własnego, niestandardowego systemu klawiszy;
- [x] kontrast w jasnym i ciemnym motywie;
- [x] `prefers-reduced-motion` dla animacji drawera i przewijania;
- [x] tytuł dokumentu aktualizowany przez Angular Router.

### 9.4 Testy komponentów

- test budowy konfiguracji builderem;
- render nawigacji wielopoziomowej;
- aktywny artykuł i `aria-current`;
- stany loading/empty/no-results/error;
- zmiana języka;
- nawigacja po fragmencie;
- bezpieczne linki zewnętrzne i odrzucenie niedozwolonego protokołu;
- viewport desktop/tablet/mobile;
- test, że komponent `shared/ui` nie rejestruje lokalnego providera Transloco.

---

## 10. Routing, kontrakt remota i globalna pomoc

### 10.1 Trasy modułu

Każdy moduł dodaje dwie trasy wskazujące ten sam lazy component:

```typescript
{
  path: 'documentation',
  loadComponent: () => import('@erp/MODULE/feature').then(m => m.DocumentationComponent),
},
{
  path: 'documentation/:articleSlug',
  loadComponent: () => import('@erp/MODULE/feature').then(m => m.DocumentationComponent),
}
```

Nie używać query parametru jako głównego identyfikatora artykułu. Czytelny slug ma być częścią URL,
aby link nadawał się do wklejenia w komentarzu, zgłoszeniu lub wiadomości.

Smart page dokumentacji aktualizuje `Title` reaktywnie po załadowaniu artykułu i zmianie locale.
Nie wpisywać polskiego literału w `Route.title`, ponieważ nie zareaguje poprawnie na zmianę języka.

### 10.2 Pomoc kontekstowa

Publiczne trasy funkcjonalne dostają:

```typescript
data: {
  documentationArticleId: TASK_MANAGEMENT_DOCUMENTATION_ARTICLE_IDS.issues.list
}
```

Trasy szczegółowe, np. `/task-management/issue/:key`, wskazują artykuł karty zgłoszenia. Przycisk
pomocy w shellu odczytuje najgłębszy aktywny snapshot trasy. Jeśli brak mapowania, otwiera overview
bieżącego modułu, a poza modułem — globalne `/help`.

### 10.3 Lokalizacja menu i breadcrumbs

Obecny `ErpNavigationItem.label` jest zwykłym stringiem, a `erp-navigation-menu` renderuje go bez
`erpTranslate`. Nie dodawać kolejnego twardo wpisanego napisu „Dokumentacja”. Wprowadzić kompatybilne
pole `labelKey`:

```typescript
export interface ErpNavigationItem {
  readonly label: string;      // fallback i zgodność istniejących modułów
  readonly labelKey?: string;  // preferowane dla nowych wpisów
}
```

Komponent menu tłumaczy `labelKey`, gdy jest podane, w przeciwnym razie pokazuje `label`. Pozycje
dokumentacji korzystają ze wspólnego klucza `shared.documentation.navigationLabel`, ponieważ shared
scope jest dostępny w shellu bez ładowania tłumaczeń remota. Analogicznie sprawdzić mechanizm
breadcrumbs; jeśli nie obsługuje kluczy, dodać kompatybilne `breadcrumbKey` zamiast wpisywać nowy
polski literał. Migracja wszystkich istniejących etykiet menu jest osobnym zadaniem i nie blokuje
dokumentacji.

### 10.4 Kontrakt remota

Utworzyć w każdym kontrakcie:

```text
frontend/libs/modules/MODULE/contract/src/lib/entry.documentation.ts
```

Eksport ma zawierać tylko lekki descriptor i leniwe funkcje:

```typescript
export const remoteDocumentation = {
  moduleId: 'task-management',
  routePrefix: 'task-management',
  requiredPermission: ERP_PERMISSIONS.TaskManagement.IssueRead,
  loadIndex: (locale: 'pl-PL' | 'en-US') =>
    import('@erp/task-management/feature').then(m => m.loadDocumentationIndex(locale)),
};
```

Nie wolno statycznie re-eksportować komponentu lub pełnej treści dokumentacji z `contract`, ponieważ
wciągnęłoby to `feature` do bundla startowego remota.

### 10.5 Rejestr hosta

Rozszerzyć typ kontraktu ładowany w `STARTUP.ts` o opcjonalne `remoteDocumentation`. Rejestracja:

- zachowuje loader, ale go nie wykonuje;
- filtruje moduły po głównym uprawnieniu odczytu;
- nie blokuje startu aplikacji, jeśli remote nie udostępnia dokumentacji;
- zgłasza kontrolowane ostrzeżenie, jeśli loader indeksu remota zawiedzie;
- cache'uje indeks per moduł i locale;
- czyści cache locale po zmianie języka, ale nie przeładowuje niezmienionego kodu.

### 10.6 Globalne `/help`

Globalna strona ma:

- listę modułów dostępnych użytkownikowi;
- wyszukiwanie po wszystkich leniwie pobranych indeksach;
- grupowanie wyników po module;
- bezpośrednie przejście do artykułu w remocie;
- stan częściowy: awaria jednego remota nie ukrywa dokumentacji pozostałych;
- brak pełnych artykułów w globalnym indeksie — tylko tekst potrzebny do wyszukania i snippet.

Nie ukrywamy w artykule opisu pojedynczej akcji tylko dlatego, że użytkownik nie ma jej uprawnienia.
Artykuł informuje, jakie uprawnienie jest wymagane. Cały moduł może być ukryty z globalnej pomocy,
jeżeli użytkownik nie ma nawet podstawowego prawa odczytu modułu.

---

## 11. Generator dokumentacji użytkownika

### 11.1 Wejście

Generator skanuje tylko jawnie wskazane katalogi modułów lub manifesty. Nie zakłada, że każdy remote
ma już dokumentację.

Wejście jednego modułu:

- `documentation.manifest.json` walidowany względem typów i schematu;
- `content/pl-PL/**/*.md`;
- `content/en-US/**/*.md`;
- opcjonalne obrazy w `content/assets/`.

Manifest wykonawczy jest statycznym JSON-em bez wywołań Angular DI. Cienki kod TypeScript importuje
go z kontrolą typu. Nie dodawać własnego runtime TypeScript tylko dla generatora.

### 11.2 Wyjście

Generator tworzy:

- mapę artykułów per locale;
- hierarchię nawigacji;
- tytuły i summary wyciągnięte z Markdown;
- spis nagłówków i anchory;
- znormalizowany indeks wyszukiwania;
- mapę tras kontekstowych;
- listę poprzedni/następny;
- listę powiązanych artykułów.

Osobnym wynikiem jest `documentation-article-ids.generated.ts` w `MODULE/util`. Generator musi
tworzyć go deterministycznie i nie może przez niego wprowadzić statycznego importu `feature` do
`contract`.

Treść i indeks generować osobno dla każdego locale. Loader strony importuje tylko plik aktualnego
języka, a zmiana języka dociąga drugi plik dynamicznie. `loadDocumentationIndex(locale)` ładuje
wyłącznie mały plik wyszukiwania, nie HTML artykułów.

### 11.3 Normalizacja wyszukiwania

Pierwsza wersja nie wymaga nowej biblioteki wyszukiwania. Generator przygotowuje mały indeks:

- lower-case;
- usunięcie diakrytyków wyłącznie na potrzeby porównania;
- tokeny z tytułu, summary, nagłówków i treści;
- większa waga tytułu i nagłówka niż treści;
- minimalna długość zapytania 2 znaki;
- limit wyników na moduł;
- debounce po stronie UI.

Jeżeli indeks przekroczy uzgodniony budżet, dopiero wtedy ocenić bibliotekę typu MiniSearch/FlexSearch.
Nie dodawać jej profilaktycznie.

### 11.4 Walidacje

`docs:check:user` kończy się błędem, gdy:

- brak `overview` modułu;
- slug albo `articleId` jest zduplikowany;
- artykuł istnieje tylko w jednym języku;
- zestaw wymaganych nagłówków PL/EN różni się strukturalnie;
- manifest wskazuje nieistniejący plik lub powiązany artykuł;
- obraz nie ma `alt`;
- link lub anchor jest niepoprawny;
- kontekstowa trasa wskazuje nieistniejący artykuł;
- publiczna trasa funkcjonalna nie ma `documentationArticleId`, chyba że ma jawne
  `documentationExemptReason`;
- artykuł nie jest osiągalny z nawigacji ani wyników powiązanych;
- wygenerowane pliki są nieaktualne;
- w artykule pojawia się surowy HTML albo niedozwolony protokół linku.

Walidację pokrycia tras wykonać testem w bibliotece `contract`, a nie przez niedeterministyczne
parsowanie TypeScriptu w skrypcie Node. Dla każdego dokumentowanego modułu utworzyć
`documentation-routes.spec.ts`, który:

- importuje `remoteRoutes` i wygenerowany rejestr article ID z `@erp/MODULE/util`;
- przechodzi rekurencyjnie po trasach;
- pomija redirecty, trasę dokumentacji i techniczne wrappery bez komponentu;
- wymaga `documentationArticleId` albo niepustego `documentationExemptReason` na każdej publicznej
  trasie ładującej ekran;
- sprawdza, czy wskazany article ID istnieje.

---

## 12. Pilot: moduł Catalog

Catalog jest pierwszym modułem, ponieważ ma mniejszy zakres niż Task Management i jest referencyjnym
modułem architektury. Przed pisaniem artykułów trzeba jednak oddzielić funkcje działające od atrap.

### 12.1 Audyt możliwości

Utworzyć tabelę roboczą:

| Capability ID | Trasa/ekran | UI osiągalne | Backend podpięty | Uprawnienie | E2E | Dokumentować |
|---|---|---:|---:|---|---:|---:|

Sprawdzić co najmniej:

- listę produktów i filtry;
- sortowanie, kolumny i zaznaczenie;
- ustawianie nazwy i ceny;
- klasyfikację produktu;
- multimedia produktu;
- gwarancje;
- bibliotekę mediów;
- usuwanie nieużywanych zasobów;
- generowanie wariantów/miniatur;
- pobieranie plików;
- raport/eksport produktu;
- feed zadań i pobieranie rezultatu.

Pozycje menu bez trasy oraz akcje kończące się wyłącznie `console.log` oznaczyć jako niedostępne.
Ich naprawa lub usunięcie jest osobnym zadaniem produktowym; dokumentacja nie może ich legitymizować.

#### Wynik audytu Catalogu (04.09.2026)

W kolumnie E2E „tak” oznacza kompletny łańcuch kodu UI → orkiestrator/klient NSwag → endpoint API,
bez atrapy `console.log`, potwierdzony testami właściwej biblioteki i buildem aplikacji. Osobne
scenariusze przeglądarkowe samego systemu pomocy są opisane w §18.3.

| Capability ID | Trasa/ekran | UI osiągalne | Backend podpięty | Uprawnienie | E2E | Dokumentować |
|---|---|---:|---:|---|---:|---:|
| `catalog.products.search` | `/catalog/products` | tak | `searchProduct` | `catalog.product.read` | tak | tak — lista i filtry |
| `catalog.products.table` | `/catalog/products` | tak | sortowanie i paginacja `searchProduct` | `catalog.product.read` | tak | tak — lista i filtry |
| `catalog.products.set-name` | toolbar listy | tak | batch `ProductSetNameCommand` | `catalog.product.bulk` | tak | tak — edycja masowa |
| `catalog.products.set-price` | toolbar listy | tak | batch `ProductSetPriceCommand` | `catalog.product.bulk` | tak | tak — edycja masowa |
| `catalog.products.classification` | akcje listy | nie — widoczne akcje atrybutów kończą się `console.log` | endpoint istnieje | brak pełnej bramki UI | nie | nie |
| `catalog.products.multimedia` | panel produktu | częściowo | endpointy przypięcia i plików istnieją | mieszane | niezweryfikowane | nie w pilocie |
| `catalog.products.warranties` | panel produktu | częściowo — mutacje zbiorcze są atrapami | endpointy istnieją | mieszane | nie | nie |
| `catalog.multimedia.search` | `/catalog/multimedia` | tak | `searchMultimedia` | `catalog.dictionary.read` | tak | tak — biblioteka mediów |
| `catalog.multimedia.remove-unused` | toolbar biblioteki | tak | batch `MultimediaRemoveCommand` | `catalog.multimedia.update` | tak | tak — biblioteka mediów |
| `catalog.multimedia.derivatives` | toolbar biblioteki | tak | batch `MultimediaExecGenerateDerivativesCommand` | `catalog.multimedia.update` | tak | tak — biblioteka mediów |
| `catalog.multimedia.download` | toolbar biblioteki | tak | URL pobrania z API/MinIO | `catalog.dictionary.read` | tak | tak — biblioteka mediów |
| `catalog.products.export` | toolbar listy | nie — CSV/XML kończą się `console.log` | raport backendowy istnieje | brak pełnej bramki UI | nie | nie |
| `catalog.jobs.track` | panel zadań hosta | tak | Notification job feed i resolvery wyników | dostęp do modułu/zadania | tak | tak — zadania w tle |

Treść pilota nie opisuje klasyfikacji, gwarancji, eksportu ani niezweryfikowanego przebiegu
multimediów na karcie produktu. Artykuł o zadaniach nie sugeruje już, że atrapowy eksport z listy
produktów jest dostępny.

### 12.2 Pliki Catalogu

Utworzyć:

```text
frontend/libs/modules/catalog/feature/src/lib/documentation/
├── page/documentation.component.ts
├── page/documentation.store.ts
├── documentation.manifest.json
├── content/pl-PL/
│   ├── overview.md
│   ├── products/list-and-filters.md
│   ├── products/bulk-edit.md
│   ├── products/multimedia.md
│   ├── products/warranties.md
│   ├── multimedia/library.md
│   ├── multimedia/derivatives.md
│   ├── background-jobs.md
│   ├── permissions.md
│   └── troubleshooting.md
└── content/en-US/               # identyczna struktura
```

Lista jest punktem startowym, nie obowiązkiem tworzenia pustych artykułów. Artykuł powstaje wyłącznie
dla zweryfikowanej możliwości.

### 12.3 Integracja Catalogu

- [x] wyeksportować `CatalogDocumentationComponent` i loader indeksu z `catalog/feature`;
- [x] dodać `entry.documentation.ts` do `catalog/contract`;
- [x] dodać lazy routes `documentation` i `documentation/:articleSlug`;
- [x] dodać pozycję „Dokumentacja” na końcu menu modułu;
- [x] dodać `documentationArticleId` do tras `products` i `multimedia`;
- [x] dodać scope tłumaczeń dla chrome strony tylko wtedy, gdy shared scope nie wystarcza;
- [x] uruchomić generator;
- [x] przetestować bezpośredni URL w trybie monolitu i MFE.

### 12.4 Weryfikacja pilota

```bash
pnpm docs:generate
pnpm docs:check
pnpm nx run shared-ui:test
pnpm nx run catalog-feature:test
pnpm nx run catalog-contract:test
pnpm nx run catalog:lint
pnpm nx run catalog:build
pnpm nx run client:build
```

Jeżeli faktyczne nazwy targetów różnią się od powyższych, przed uruchomieniem sprawdzić je przez
`pnpm nx show project <name>`. Nie zgadywać nazw targetów w skrypcie CI.

W przeglądarce sprawdzić:

- wejście z menu;
- wejście z pomocy kontekstowej na liście produktów;
- wyszukiwanie PL i EN;
- bezpośredni link po pełnym odświeżeniu;
- back/forward;
- fragment nagłówka;
- jasny i ciemny motyw;
- rozmiary fontu S–XL;
- desktop, tablet i mobile;
- brak dostępu użytkownika bez `catalog.product.read`;
- niedostępność jednego remota nie blokuje shellu.

---

## 13. Moduł Task Management

### 13.1 Warunek rozpoczęcia

Integrację rozpocząć dopiero, gdy:

- bieżąca faza `plans/active/task-management.md` jest zakończona albo ma stabilny commit;
- `git status --short` nie pokazuje konfliktujących zmian w `task-management/feature`, kontrakcie,
  routingu ani słownikach;
- aktualny zestaw tras i funkcji został ponownie zinwentaryzowany;
- dokumenty `domain.md`, `requirements.md` i `screens.md` zostały poprawione tak, aby odzwierciedlały
  kod, a nie historyczne fazy.

### 13.2 Zakres artykułów

Docelowa hierarchia:

```text
overview
getting-started/
projects/
issues/
  list-and-filters
  create
  issue-detail
  fields-and-transitions
  comments-and-activity
  attachments
  links-and-hierarchy
  tags-and-watchers
  work-logs
boards/
  board
  backlog-and-sprints
requests/
reports/
automation/
webhooks/
permissions/
troubleshooting/
```

Każdy temat przechodzi tę samą kwalifikację co Catalog: UI + backend + uprawnienie + E2E.

#### Wynik audytu Task Management (04.09.2026)

Audyt obejmuje publiczne ekrany zadeklarowane w `entry.routes.ts`. Te ekrany mają kompletny łańcuch
do API; test kontraktu dodatkowo wymusza `documentationArticleId` albo jawny wyjątek dla każdej
nowej publicznej trasy.

| Capability ID | Trasa/ekran | UI osiągalne | Backend podpięty | Uprawnienie | E2E | Dokumentować |
|---|---|---:|---:|---|---:|---:|
| `task-management.issues.search` | `/task-management/issue` | tak | Issue queries | `taskmgmt.issue.read` | tak | tak — lista zgłoszeń |
| `task-management.issues.detail` | `/task-management/issue/:key` | tak | Issue query/commands | `taskmgmt.issue.read` + prawa mutacji | tak | tak — karta zgłoszenia |
| `task-management.requests` | `/task-management/request` | tak | Issue queries z trybem zleceń | `taskmgmt.issue.read` | tak | tak — zlecenia |
| `task-management.projects.list` | `/task-management/project` | tak | Project queries | `taskmgmt.issue.read` | tak | tak — projekty |
| `task-management.projects.detail` | `/task-management/project/:uuid` | tak | Project i scheme commands/queries | `taskmgmt.project.manage` | tak | tak — konfiguracja projektu |
| `task-management.boards.list` | `/task-management/board` | tak | Board queries | `taskmgmt.issue.read` | tak | tak — lista tablic |
| `task-management.boards.board` | `/task-management/board/:uuid` | tak | Board cards i workflow commands | `taskmgmt.issue.read` + prawa mutacji | tak | tak — tablica |
| `task-management.boards.backlog` | `/task-management/board/:uuid/backlog` | tak | Sprint/board commands | `taskmgmt.issue.read` + prawa mutacji | tak | tak — backlog i sprinty |
| `task-management.reports.hours` | `/task-management/report` | tak | report run API | `taskmgmt.report.read.all` | tak | tak — raport godzin |
| automatyzacje i webhooki | brak publicznej trasy | nie | API/domena nie stanowią ekranu użytkownika | osobne prawa | nie | nie w tej iteracji |

Artykuły dotyczą wyłącznie powyższych ekranów oraz przekrojowych uprawnień i diagnostyki. Nie
powstały strony sugerujące dostępność automatyzacji lub webhooków bez publicznego UI.

### 13.3 Customowe UI — reguły

Dokumentacja nie może wymusić przeniesienia komponentu domenowego do `shared/ui`.

Pozostają modułowe, dopóki nie pojawi się drugi realny konsument:

- `erp-issue-card`;
- `erp-issue-key`;
- `erp-field-panel`;
- `erp-link-list`;
- `erp-tag-chips`.

`erp-activity-stream` może zostać kandydatem do uogólnienia dopiero po porównaniu z drugim strumieniem
aktywności, np. DMS. Nie generalizować na podstawie hipotetycznego użycia.

Jeżeli podczas budowy dokumentacji potrzebny jest wspólny element prezentacyjny, najpierw sprawdzić:

1. czy istnieje w `@erp/shared/ui`;
2. czy jest elementem języka całej aplikacji, a nie semantyką Issue;
3. czy ma przynajmniej dwa realne miejsca użycia;
4. czy jego API da się opisać bez typów Task Management.

W przeciwnym razie pozostaje lokalny.

### 13.4 Osobny audyt wizualny

Pełne ujednolicenie wyglądu Task Management nie wchodzi jako ukryty zakres tej implementacji. Po
uruchomieniu wspólnego frameworka dokumentacji utworzyć osobny plan obejmujący:

- spacing i typografię;
- szerokości paneli i responsywność;
- rozmieszczenie akcji;
- loading/empty/error states;
- kolory i tokeny Taiga UI;
- zachowanie tablicy na wąskich ekranach;
- testy wizualne najważniejszych ekranów.

W ramach bieżącego planu wolno poprawić wyłącznie drobny problem blokujący integrację dokumentacji.

### 13.5 Integracja

- [x] utworzyć strukturę `feature/src/lib/documentation/`;
- [x] napisać artykuły PL/EN tylko dla zweryfikowanych funkcji;
- [x] dodać route metadata dla listy zgłoszeń, karty, projektów, tablicy, backlogu, zleceń i raportu;
- [x] dodać `entry.documentation.ts` do kontraktu;
- [x] dodać trasę oraz pozycję menu;
- [x] uruchomić generator i walidację;
- [x] zbudować `task-management` w trybie monolitu i MFE;
- [x] wykonać testy kontekstowego przycisku pomocy z trasą zawierającą parametr `:key` i `:uuid`.

---

## 14. Rozszerzenie na kolejne moduły

### 14.1 Minimalny zestaw dokumentacji modułu

Każdy dojrzały moduł dostaje co najmniej:

- overview;
- capabilities;
- workflows;
- permissions;
- troubleshooting.

Moduł będący atrapą nie publikuje fikcyjnej listy możliwości. Może:

- nie rejestrować dokumentacji wcale; albo
- publikować wyłącznie krótkie overview „moduł nie jest jeszcze dostępny”, jeśli jest to potrzebne
  użytkownikom środowiska testowego.

### 14.2 Kolejność

1. Catalog — pilot.
2. Globalne `/help` i pomoc kontekstowa.
3. Task Management — po stabilizacji aktywnego planu.
4. Identity — uprawnienia i administracja użytkownikami.
5. Notification — zadania i powiadomienia.
6. Sales — dopiero po oddzieleniu szkieletu od realnych funkcji.
7. Inventory i DMS — wraz z rzeczywistą implementacją modułów.

---

## 15. Proces dodawania nowej funkcjonalności po wdrożeniu systemu dokumentacji

Do `docs/contributing/documentation.md` dodać wiążącą procedurę:

### 15.1 Ocena wpływu

Każda zmiana użytkowa odpowiada na pytania:

1. Czy powstaje nowy ekran, modal, akcja albo ważny wariant przebiegu?
2. Czy zmieniają się wymagane uprawnienia?
3. Czy zmienia się rezultat albo ograniczenie istniejącej operacji?
4. Czy dotychczasowa instrukcja prowadzi użytkownika przez nieaktualne kroki?

Jeśli odpowiedź na którekolwiek pytanie brzmi „tak”, dokumentacja użytkownika jest częścią Definition
of Done zmiany.

### 15.2 Implementacja

1. Dodać lub wybrać stabilny `capabilityId`.
2. Dodać `documentationArticleId` do nowej trasy albo powiązać akcję w manifeście.
3. Utworzyć artykuł przez `pnpm docs:scaffold --module MODULE --article ARTICLE_ID` albo zaktualizować
   istniejący.
4. Uzupełnić PL i EN.
5. Dodać wymagane uprawnienie i ograniczenia.
6. Uruchomić `pnpm docs:generate`.
7. Uruchomić `pnpm docs:check`.
8. Przejść instrukcję na działającej aplikacji.
9. Zaktualizować screenshot tylko wtedy, gdy niesie informację, której nie da się lepiej opisać tekstem.

### 15.3 Review

Reviewer sprawdza niezależnie:

- zgodność instrukcji z UI;
- brak opisów funkcji niegotowych;
- kompletność PL/EN;
- język zrozumiały dla użytkownika biznesowego;
- poprawność uprawnień i ograniczeń;
- brak szczegółów implementacyjnych;
- działanie linków kontekstowych.

---

## 16. CI i bramki jakości

### 16.1 Obowiązkowe joby

W CI uruchamiać:

```bash
pnpm docs:check
pnpm nx affected -t lint
pnpm nx affected -t test
pnpm nx affected -t build
```

Jeżeli zmieniono treść dokumentacji użytkownika albo generator, wykonać build co najmniej hosta i
dotkniętego remota nawet wtedy, gdy Nx nie rozpozna zależności plików `.md`. W razie potrzeby dodać
Markdown i manifesty jako `implicitDependencies`/inputs odpowiednich targetów, żeby cache Nx był
poprawnie unieważniany.

### 16.2 Testy E2E

Minimalny zestaw:

- otwarcie `/help`;
- wyszukanie artykułu z Catalogu;
- przejście do artykułu remota;
- otwarcie pomocy kontekstowej z funkcjonalnej trasy;
- bezpośrednie wejście na URL artykułu po reloadzie;
- przełączenie PL ↔ EN;
- obsługa niedostępnego remota;
- filtrowanie modułów po uprawnieniach;
- nawigacja klawiaturą;
- widok mobilny.

### 16.3 Budżety

- pełna treść artykułów nie może wejść do initial bundle hosta;
- pełna treść innych modułów nie może wejść do bundla bieżącego remota;
- globalny indeks ładuje się dopiero po wejściu do `/help` albo użyciu globalnego wyszukiwania;
- wynik wyszukiwania powinien pojawić się bez żądania do backendu biznesowego;
- rozmiar wygenerowanego indeksu mierzyć w CI i ustalić ostrzeżenie po pilocie Catalogu.

---

## 17. Kolejność wykonania i sugerowane commity

### Faza 0 — baseline

- [x] zapisać wynik `git status --short`;
- [x] uruchomić obecne buildy/testy w zakresie niezbędnym do ustalenia baseline;
- [x] sporządzić kompletną mapę linków Markdown i referencji do planów;
- [x] potwierdzić aktualne targety Nx;
- [x] nie poprawiać zastanych błędów niezwiązanych z dokumentacją.

**Commit:** brak — faza diagnostyczna.

### Faza 1 — fundament planów i dokumentacji

- [x] utworzyć strukturę `plans/` i `docs/`;
- [x] dodać metadane i ich schemat;
- [x] dodać skaner, generator indeksów i walidator linków;
- [x] dodać skrypty `docs:*`;
- [x] objąć testami parser front matter i generator anchorów.

**Commit:** `docs: add documentation taxonomy and validation tooling`

### Faza 2 — oddzielenie trwałej wiedzy od planów

- [x] przejrzeć dokumenty z tabeli w §5;
- [x] przenieść jednorazowe kolejności do `plans/backlog/`;
- [x] usunąć z dokumentów architektonicznych dzienniki faz;
- [x] zastąpić referencje kod → aktywny plan referencjami do trwałych dokumentów;
- [x] przenieść aktywny i zakończony plan zgodnie z §7.

**Commit:** `docs: separate implementation plans from durable documentation`

### Faza 3 — migracja `docs/`

- [x] wykonać wszystkie `git mv` z §4;
- [x] utworzyć brakujące `README.md` i dokumenty referencyjne;
- [x] zaktualizować wszystkie linki w repozytorium;
- [x] wygenerować indeksy `docs`, `AGENTS.md` i `CLAUDE.md`;
- [x] usunąć puste stare katalogi;
- [x] uruchomić `docs:check:technical`.

**Commit:** `docs: reorganize technical documentation from overview to detail`

### Faza 4 — framework dokumentacji użytkownika

- [x] dodać typy w `shared/util`;
- [x] dodać komponenty w `shared/ui` zgodnie z Single Config Builder;
- [x] dodać generator i walidator treści modułów;
- [x] dodać registry/search service w `shared/data-access`;
- [x] dodać testy jednostkowe i dostępności.

**Commit:** `feat(documentation): add shared user documentation framework`

### Faza 5 — pilot Catalog

- [x] wykonać audyt capabilities;
- [x] napisać zweryfikowane artykuły PL/EN;
- [x] dodać routing, menu, metadata tras i kontrakt remota;
- [x] zweryfikować monolit oraz MFE;
- [x] ustalić budżet indeksu na podstawie realnych danych.

**Commit:** `feat(catalog): add contextual user documentation`

### Faza 6 — globalne centrum pomocy

- [x] dodać loader registry do `STARTUP.ts`;
- [x] dodać stronę `/help`;
- [x] dodać przycisk pomocy do shellu;
- [x] dodać wyszukiwanie między modułami;
- [x] dodać obsługę częściowej awarii remote.

**Commit:** `feat(client): add federated help center`

### Faza 7 — Task Management

- [x] spełnić warunki z §13.1;
- [x] wykonać audyt aktualnych capabilities;
- [x] poprawić trwałe dokumenty techniczne modułu;
- [x] napisać dokumentację użytkownika PL/EN;
- [x] dodać kontekstowe mapowanie wszystkich publicznych tras;
- [x] zweryfikować trasy z parametrami i uprawnienia.

**Commit:** `feat(task-management): add contextual user documentation`

### Faza 8 — rollout i governance

- [x] dodać procedurę do `docs/contributing/documentation.md`;
- [x] podłączyć `docs:check` do CI;
- [x] zaktualizować przepis tworzenia nowego modułu o obowiązkową dokumentację;
- [x] dodać checklistę documentation impact do procesu review;
- [x] zaplanować Identity i Notification;
- [x] utworzyć osobny plan spójności wizualnej Task Management.

**Commit:** `docs: make user documentation part of feature definition of done`

### Faza 9 — zamknięcie planu

- [x] wykonać pełną weryfikację z §18;
- [x] potwierdzić brak starych ścieżek `docs/frontend`, `docs/backend` i rootowych `PLAN*.md`;
- [x] potwierdzić, że żadna funkcja-atrapa nie jest opisana jako dostępna;
- [x] przenieść ten plan do `plans/archive/2026-09-documentation-organization.md`.

**Commit:** `docs: archive completed documentation implementation plan`

---

## 18. Końcowa weryfikacja

### 18.1 Struktura i linki

```bash
test ! -f PLAN.md
test ! -f PLAN-task-management.md
test ! -d docs/frontend
test ! -d docs/backend
rg -n 'docs/(frontend|backend)/|PLAN-task-management\.md' . \
  --glob '!node_modules/**' \
  --glob '!**/bin/**' \
  --glob '!**/obj/**' \
  --glob '!plans/archive/**' \
  --glob '!tools/scripts/documentation/**'
pnpm docs:check
```

Wynik `rg` trzeba sklasyfikować. Nie może zawierać aktywnego linku lub komentarza korzystającego ze
starej ścieżki; literalne wzorce w walidatorze i tekst zachowany w archiwalnym planie są dozwolone.

### 18.2 Frontend

```bash
pnpm nx run shared-ui:lint
pnpm nx run shared-ui:test
pnpm nx run catalog:lint
pnpm nx run catalog:build
pnpm nx run catalog-contract:test
pnpm nx run task-management:lint
pnpm nx run task-management:build
pnpm nx run task-management-contract:test
pnpm nx run client:lint
pnpm nx run client:build
```

Przed uruchomieniem potwierdzić właściwe nazwy projektów/targetów przez `pnpm nx show projects` i
`pnpm nx show project <name>`. Komendy w planie opisują wymagany zakres, nie upoważniają do ignorowania
rzeczywistej konfiguracji Nx.

### 18.3 Przeglądarka

- [x] `/help` działa po pełnym reloadzie;
- [x] Catalog i Task Management otwierają overview z menu;
- [x] pomoc z listy produktów trafia do właściwego artykułu;
- [x] pomoc z `/task-management/issue/:key` trafia do karty zgłoszenia;
- [x] wyszukiwanie znajduje tytuł, nagłówek i termin w treści;
- [x] wyszukiwanie bez polskich znaków znajduje polskie hasło;
- [x] PL i EN mają tę samą strukturę tematów;
- [x] fragment URL ustawia poprawną sekcję;
- [x] back/forward nie gubi aktywnego artykułu;
- [x] brak uprawnienia ukrywa niedostępny moduł, ale nie łamie `/help`;
- [x] awaria jednego remota pokazuje lokalny błąd i zachowuje resztę wyników;
- [x] mobile, jasny/ciemny motyw i font XL nie powodują poziomego scrolla treści;
- [x] dokumentację da się obsłużyć bez myszy.

### 18.4 Kryteria akceptacji

Plan jest ukończony, gdy:

1. Każdy dokument techniczny jest osiągalny z `docs/README.md` przez najwyżej dwa indeksy.
2. Nie ma dokumentów osieroconych ani zepsutych linków.
3. `AGENTS.md`, `CLAUDE.md` i indeksy `docs` korzystają z jednego katalogu metadanych.
4. W `docs/` nie ma jednorazowych planów ani dzienników realizacji.
5. Wszystkie plany znajdują się w `plans/active`, `plans/backlog` albo `plans/archive`.
6. Kod produkcyjny nie używa aktywnego planu jako źródła trwałej reguły.
7. Catalog i Task Management mają wersjonowaną dokumentację użytkownika PL/EN.
8. Każda publiczna trasa tych modułów ma pomoc kontekstową albo jawne uzasadnienie wyjątku.
9. Globalne `/help` przeszukuje aktywne moduły bez ładowania pełnych artykułów przy starcie hosta.
10. Dokumentacja nie opisuje atrap jako działających funkcji.
11. Generatory są deterministyczne, a CI wykrywa nieaktualne pliki wynikowe.
12. Buildy, lint, testy i scenariusze przeglądarkowe przechodzą.

### 18.5 Wynik realizacji

- `pnpm docs:check` przechodzi dla 42 dokumentów technicznych oraz dokumentacji użytkownika PL/EN.
- Testy `shared-util`, `shared-data-access`, `shared-ui`, `client-feature`, Catalogu i Task Management
  przechodzą; scenariusz częściowej awarii jest pokryty jednostkowo i zweryfikowany w Native Federation.
- Produkcyjne buildy `client`, `catalog` i `task-management` przechodzą.
- Scenariusze przeglądarkowe z §18.3 przeszły w monolicie i MFE, w tym fail-closed uprawnień,
  awaria pojedynczego remota, mobile 375 px, font XL oraz jasny/ciemny motyw.
- Pliki dodane lub zmienione przez ten plan przechodzą ESLint bez błędów. Pełne targety
  `shared-ui:lint`, `client:lint` i `task-management:lint` nadal raportują zastane naruszenia spoza
  dokumentacji (m.in. granice warstw, natywna nazwa outputu i brak typu zwrotnego). Zgodnie z §1.3
  i Fazą 0 nie rozszerzano zakresu o ich naprawę; `catalog:lint` przechodzi w całości.

---

## 19. Ryzyka i sposoby ograniczenia

| Ryzyko | Ograniczenie |
|---|---|
| Masowe przeniesienie zerwie setki linków | atomowy commit, automatyczny checker linków i `rg` starych ścieżek |
| Aktywny plan Task Management zmienia te same pliki | integracja modułu dopiero po stabilnym punkcie i kontrola worktree przed fazą |
| Dokumentacja zacznie opisywać atrapy Catalogu | jawny audyt capability UI/backend/E2E przed napisaniem artykułu |
| Dwa języki szybko się rozjadą | walidacja identycznych ID i struktury wymaganych sekcji w CI |
| Markdown stanie się wektorem XSS | HTML wyłączony, whitelist protokołów, sanitizer Angulara, brak bypassu |
| Globalna pomoc powiększy initial bundle | wyłącznie leniwe loadery indeksów w kontraktach remotów |
| Komponent dokumentacji stanie się drugim design systemem | reuse istniejących atomów; nowe elementy tylko dla semantyki dokumentacji |
| Refaktor Task Management rozszerzy zakres bez kontroli | osobny plan wizualny; brak generalizacji bez drugiego konsumenta |
| Generator zmodyfikuje ręczną część AGENTS/CLAUDE | obowiązkowe markery i test zakresu wygenerowanego bloku |
| Cache Nx nie zauważy zmiany `.md` | dodać pliki content/manifest do inputs targetów |
| Ręczny status implementacji ponownie się zestarzeje | status funkcji wynika z jawnego audytu/manifestu, nie z tabeli faz w architekturze |

---

## 20. Decyzje przyjęte w tym planie

1. Dokumentacja użytkownika powstaje od początku po polsku i angielsku.
2. Każdy aktywny moduł ma własną stronę, a host ma dodatkowo globalne `/help`.
3. Plany wolno przenosić; nie utrzymujemy stubów starych ścieżek.
4. Zakończony `PLAN.md` archiwizujemy zamiast usuwać bez śladu.
5. Dokumentacja użytkownika jest częścią kodu `feature`, nie nową warstwą Nx i nie backendowym CMS-em.
6. Markdown jest kompilowany do bezpiecznego modelu w czasie generowania.
7. Dłuższa treść artykułów nie trafia do Transloco; chrome strony pozostaje w Transloco.
8. Nie generujemy automatycznie prozy z endpointów ani komponentów.
9. `erp-grid-layout` nie jest layoutem dokumentacji.
10. Refaktor wizualny Task Management ma osobny plan i nie blokuje frameworka dokumentacji.
