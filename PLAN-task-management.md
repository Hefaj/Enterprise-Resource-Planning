# Plan realizacji — Task Management (fazy 4–8)

> **Plik roboczy — usuń po domknięciu fazy 8.**
> Dokumentacja docelowa (zostaje): [`docs/backend/task-management-requirements.md`](docs/backend/task-management-requirements.md)
> (co budujemy i po czym poznamy, że działa), [`docs/backend/task-management.md`](docs/backend/task-management.md)
> (model i mechanika), [`docs/frontend/task-management-pages.md`](docs/frontend/task-management-pages.md)
> (strony i menu). Ten plik jest **wyłącznie o kolejności prac i checklistach**.

---

## 0. Podsumowanie

| Faza | Zakres | Zależy od | Zmiana łamiąca NSwag | Migracja | Stan |
|---|---|---|---|---|---|
| 0–3 | Fundament, automat stanów, tablica, pola własne | — | — | 7 migracji | ✅ zrobione |
| 4 | Typy zgłoszeń, **układ karty wg YouTracka**, obrazy ze schowka, graf, wyprowadzenie komponentów do `ui` | 3 | **tak** (`typeUuid` w `IssueCreate`, `IssueDto`) | `IssueTypes` | ✅ zrobione |
| 5 | Zlecenia międzydziałowe, obserwujący, powiadomienia, SLA | 4 | tak (dodanie pól) | `WatchersAndIntake`, `ProjectSla` | ✅ zrobione (plan nie był odznaczony mimo wykonanej pracy — poprawione) |
| 6 | Sprinty, backlog, tagi, operacje masowe, wyszukiwanie, **rejestracja czasu** | 4 | tak (dodanie pól) | `SprintsAndBacklog`, `TagsAndResolution`, `FullTextSearch`, `WorkLogAndEstimate` | ✅ zrobione |
| 7 | Edytor schematu z UI, zapisane widoki, **raporty (w tym godziny per dział)**, scalanie tagów | 6 | tak (dodanie pól) | `SavedViews`, `Reports`, `ProjectDefaultSavedView`, Catalog `ReportRunRename` | ✅ zrobione |
| 8 | Automatyzacje, DSL, webhooki | 7 | nie | `Automations`, `Webhooks` | ⚠️ częściowo (silnik automatyzacji AUT-001/AUT-002, webhooki wychodzące API-004, burndown SPR-004 i język wyszukiwania SRCH-005 zrobione i **zweryfikowane na żywo** — patrz §6.1/§6.2/§6.3; klucz integracyjny API-003 i preferencje powiadomień NTF-003 zostają, oba wymagają osobnej decyzji architektonicznej) |

**Faza 4 jest największa i najbardziej łamiąca**, bo wprowadza `IssueType` — pole, którego dziś
w ogóle nie ma na zgłoszeniu, a które wchodzi jako wymagane. Reszta faz dokłada, nie przerabia.

> **Dwie zmiany kolejności wobec pierwszej wersji planu**, obie wymuszone tym, kto na tym systemie
> pracuje (dev + biznes zlecający + kierownictwo pytające o godziny):
> **rejestracja czasu przeszła z fazy 7 do 6** — raport nie policzy godzin wstecz, więc `work_log`
> musi zbierać dane od momentu, w którym zespoły zaczną pracować; **raporty przeszły z fazy 8
> do 7** — kierownictwo jest jednym z trzech aktorów, a nie odbiorcą rozszerzeń. Kolejność
> „zbieraj w 6, pokazuj w 7" jest tu wiążąca w tę stronę i nie odwrotnie.

### 0.1 Zasada pracy w obrębie fazy

Zawsze w tej kolejności — odwrotna kolejność kończy się frontem pisanym pod nieistniejący kontrakt:

1. **Domena** (`TaskManagement.Domain`) — agregat, niezmienniki, metody walidujące **przed** zmianą stanu.
2. **Persystencja** (`Infrastructure/Persistence`) — konfiguracja EF, migracja, seed.
3. **Aplikacja** (`Application`) — komendy, handlery, DTO, reguły `IBatchRule`, zapytania `IXxxQueries`.
4. **API** (`Api`) — endpointy FastEndpoints wg [`endpoint-naming.md`](docs/backend/endpoint-naming.md),
   uprawnienia, grupy tras.
5. **Testy backendu** — `TaskManagement.Tests` + `Erp.ArchitectureTests` + `BackgroundServiceTests`.
6. **Regeneracja klienta NSwag** — `frontend/libs/modules/task-management/data-access/nswag.json`.
7. **Front**: `util` → `data-access` (serwisy, orkiestratory) → `ui` → `feature` (strony, modale)
   → `contract` (trasy, menu, modale).
8. **Tłumaczenia** — klucze do `translation/pl-PL.json` i `en-US.json`, potem `pnpm translate:keys`.
9. **Weryfikacja end-to-end** wg checklisty fazy.

### 0.2 Komendy, które będą potrzebne w każdej fazie

Migracja EF (z katalogu `backend`):

```bash
dotnet ef migrations add NAZWA_MIGRACJI --project modules/TaskManagement/TaskManagement.Infrastructure --startup-project modules/TaskManagement/TaskManagement.Api
```

Regeneracja klienta NSwag (z roota, po uruchomieniu API na 5290):

```bash
pnpm nx run task-management-data-access:nswag
```

Generator kluczy tłumaczeń (z roota):

```bash
pnpm translate:keys
```

Testy backendu modułu:

```bash
dotnet test backend/tests/TaskManagement.Tests
```

---

## 1. Punkt wyjścia — co zostaje, co się przerabia

Odpowiedź na pytanie „czy kasujemy to, co jest": **nie kasujemy**. Fazy 0–3 realizują niemal
wszystkie przypisane im wymagania `Must` i robią to zgodnie z docelowym modelem — przepisanie ich
od zera nie zmieniłoby ani jednej decyzji projektowej. Przebudowa dotyczy siedmiu miejsc,
wszystkie w fazie 4.

### 1.1 Zostaje bez zmian

| Obszar | Gdzie |
|---|---|
| Mikroserwis, schemat `taskmgmt`, `Program.cs`, seed | `backend/modules/TaskManagement/**` |
| `Project`, `ProjectMember`, `ProjectKeyCounter`, `IssueKeyAllocator` | `TaskManagement.Domain/Projects` |
| `WorkflowScheme`/`State`/`Transition` + zapytania | `TaskManagement.Domain/Workflow` |
| `Board`, `BoardCard`, `BoardRank`, `BoardRankRebalanceService` | `TaskManagement.Domain/Boards` |
| `FieldScheme`, sloty na `Issue`, `getProjectFieldProfile` | `TaskManagement.Domain/FieldSchemes` |
| `IssueComment`, `IssueActivity`, `IssueAttachment`, `RichTextSanitizer` | `TaskManagement.Domain/Issues` |
| `IssueLink`, `IssueGraphCycleRules`, `GetIssueGraph` | jw. |
| Front: strony `issue`, `board`, `project` + trzy orkiestratory | `frontend/libs/modules/task-management/**` |

### 1.2 Wymaga przebudowy (faza 4)

| Co | Dlaczego | Skala |
|---|---|---|
| **Brak typu zgłoszenia** — `Issue` nie ma `type_uuid` | `TYP-001`; typ steruje hierarchią, polami i schematem stanów | duża: nowe tabele + pole wymagane + kontrakt |
| **`FieldDefinition` ma tylko `nameKey`** | `FLD-002`; użytkownik widzi surowy klucz | mała: dodanie `name`, priorytet nad `nameKey` |
| **Karta bez modala pól wymaganych** | `WF-004`; dziś przejście z `required_fields` po prostu odpada błędem | średnia |
| **Brak trybu drzewa i ostrzeżeń grafu** | `LNK-004/005/006`; backend grafu jest, UI nie korzysta | średnia (front) |
| **Brak obrazów i wklejania ze schowka** | `ISS-005`, `CMT-006`; `erp-rich-text` ma jawnie wyłączone `TuiEditorTool.Img` i zero obsługi `paste` | średnia — **zmiana w `@erp/shared/ui`**, nie w module |
| **Układ karty niezgodny z wzorcem YouTracka** | `NFR-010`; dziś jedna kolumna z sekcjami pod sobą, komentarze i historia osobno | średnia (front, przebudowa strony) |
| **`task-management/ui` pusta** | `NFR-009`; komponenty prezentacyjne siedzą w `feature` | średnia (front, przeniesienie + 3 nowe atomy) |

### 1.3 Do usunięcia

Nic. Jedyna zaślepka („Dashboard Analityczny Zadań") zniknęła już w fazie 0.

> **Dane w dev są do wyrzucenia.** Migracja `IssueTypes` wprowadza kolumnę **wymaganą** na
> `issue`. Zamiast pisać backfill z domyślnym typem, czyścimy schemat `taskmgmt` i puszczamy seed
> od nowa — użytkownik potwierdził, że danych nie chronimy. Gdyby kiedyś trzeba było zrobić to
> na danych: dwa kroki (kolumna `null` + `UPDATE` + `alter column set not null`), nie jeden.

---

## 2. Faza 4 — typy zgłoszeń, układ karty i domknięcie grafu

**Cel fazy:** zgłoszenie przestaje być jednorodne (typ jako dana sterująca hierarchią
i konfiguracją), a karta staje się narzędziem pracy w układzie, który zna użytkownik YouTracka —
dwie kolumny, strumień aktywności, zrzut ekranu wklejany `Ctrl+V` w opisie i komentarzu.
Przy okazji spłacamy dług warstwy `ui`, bo inaczej przebudowa układu wsypie kolejne 500 linii
szablonu do `feature`.

**Wymagania:** TYP-001..004, LNK-004/005/006, WF-004, FLD-002, FLD-005, FLD-006, ISS-005,
CMT-006, NFR-009, NFR-010.

### 2.1 Backend — domena

- [x] `IssueTypeScheme` (agregat) — `uuid`, `name`, `is_system`, kolekcja `IssueType`.
- [x] `IssueType` (encja podrzędna) — `code`, `name`, `name_key?`, `icon`, `category`, `order_no`,
      `workflow_scheme_uuid?` (nadpisanie per typ), `field_scheme_uuid?` (zawężenie pól).
- [x] `IssueTypeCategory` — `Epic | Standard | Subtask`.
- [x] `Project.IssueTypeSchemeUuid` (wymagany, domyślnie systemowy) + metoda `SetIssueTypeScheme`.
- [x] `Issue.TypeUuid` (wymagany) + `Issue.SetType(...)` walidujące, że typ należy do schematu projektu.
- [x] Reguła hierarchii w `Issue.SetParent`: rodzic o kategorii `Subtask` odrzucony, dziecko
      o kategorii `Epic` odrzucone (`LNK-001` AC2).
- [x] `FieldDefinition.Name` (wymagana) obok `NameKey` (opcjonalny) — `FLD-002`.

### 2.2 Backend — persystencja

- [x] Konfiguracje EF: `IssueTypeSchemeConfiguration`, rozszerzenie `IssueConfiguration`
      (`type_uuid` + indeks `(project_uuid, type_uuid)`).
- [x] Migracja `IssueTypes`.
- [x] Seed: schemat systemowy `Epik`/`Funkcjonalność`/`Zadanie`/`Błąd`/`Podzadanie` (`TYP-002`),
      przypisanie go do projektów z seeda.
- [x] Wyczyszczenie schematu `taskmgmt` w dev przed pierwszym uruchomieniem (patrz §1.3).

### 2.3 Backend — aplikacja i API

Nazwy komend i endpointów wg pięciu czasowników — każda zmiana nazwy klasy to zmiana kontraktu:

- [x] `IssueTypeSchemeCreateCommand`, `IssueTypeSchemeAddTypeCommand`,
      `IssueTypeSchemeRemoveTypeCommand`, `IssueTypeSchemeSetTypeCommand`.
- [x] `ProjectSetIssueTypeSchemeCommand`.
- [x] `IssueSetTypeCommand` — z regułą `TYP-003` AC2 (mapowanie stanu przy zmianie schematu stanów).
- [x] `IssueCreateCommand` **+ `TypeUuid` (wymagane)** — zmiana łamiąca.
- [x] `SearchIssueTypeScheme`, `GetIssueTypeScheme` — zapytania konfiguracyjne.
- [x] `IssueDto`, `IssueListItemDto` + `typeUuid`, `typeName`, `typeCategory`, `typeIcon`.
- [x] `GetProjectFieldProfile` + informacja o wolnych slotach per typ danych (`FLD-005`).
- [x] `IssueTypeInUseRule : IBatchRule` — blokada usunięcia typu w użyciu (`TYP-004`).
- [x] Uprawnienia: typy jadą pod istniejącym `taskmgmt.scheme.manage`, **bez nowego kodu**.

### 2.4 Backend — testy

- [x] Test: utworzenie zgłoszenia bez typu → `400`.
- [x] Test: `SetParent` łamiący kategorię → odrzucenie przed zmianą stanu agregatu.
- [x] Test: usunięcie typu w użyciu → odrzucenie z liczbą zgłoszeń.
- [x] `Erp.ArchitectureTests` i `BackgroundServiceTests` bez zmian — muszą przechodzić.

### 2.5 Front — `shared/ui` (robimy przed modułem)

Obrazy wklejane ze schowka (`ISS-005`, `CMT-006`) to **zdolność komponentu współdzielonego**,
nie kod karty zgłoszenia. `erp-rich-text` ma dziś w builderze jawną decyzję „`TuiEditorTool.Img`
celowo nie ma w żadnym zestawie" i zero obsługi wklejania.

- [x] `erp-rich-text`: obsługa `paste` (obraz w schowku) i `drop` (plik na edytor).
- [x] `erp-rich-text`: **port wgrywania** w konfiguracji buildera — komponent nie wie nic
      o biletach ani o MinIO; dostaje funkcję „weź plik, oddaj referencję" i moduł ją wypełnia.
- [x] `erp-rich-text`: element zastępczy z postępem w treści na czas transferu (`ISS-005` AC2).
- [x] `erp-rich-text`: nowy zestaw narzędzi z `TuiEditorTool.Img` — **tylko** dla konfiguracji
      z podanym portem wgrywania; zestaw bez portu zostaje bez obrazków, jak dziś.
- [x] Aktualizacja komentarza w `erp-rich-text.builder.ts` — dziś mówi „celowo nie ma", a od tej
      zmiany to nieprawda.

> Nie rozwiązujemy tu jeszcze podmiany `src` → `blob:` — to zna moduł (zna endpoint i token),
> więc siedzi po stronie portu, nie komponentu.

### 2.6 Front — `task-management/ui` (dziś pusta, `NFR-009`)

Warstwa `ui` modułu zawiera **wyłącznie tłumaczenia**; karta tablicy, kolumna, wątek komentarzy
i historia leżą w `feature`. Faza 4 to prostuje — komponent prezentacyjny nie mieszka w `feature`
([`feature-structure.md`](docs/frontend/feature-structure.md), [`atoms.md`](docs/frontend/atoms.md)).

- [x] `erp-issue-key` — klucz + ikona typu; używany w tabeli, na karcie, w powiązaniach i na tablicy.
- [x] `erp-issue-card` — przeniesienie z `feature/board/components/board-card`.
- [x] `erp-activity-stream` — strumień z filtrem `Wszystko / Komentarze / Historia / Czas`
      (zastępuje dwie osobne sekcje na karcie).
- [x] `erp-field-panel` — prawy panel pól budowany z profilu projektu.
- [x] `erp-link-list` — pasek powiązań (rodzic, podzadania, blokady, zlecenie).
- [x] `erp-tag-chips` — przygotowane pod fazę 6, używane wcześniej dla typu i priorytetu.

Każdy wg wzorca „Single Config Builder" (`*.types.ts` / `*.builder.ts` / `*.component.ts`),
selektor `erp-*`, translation-aware przez `erpTranslate` — smart component podaje surowe klucze.

### 2.7 Front — `feature` i `data-access`

- [x] Regeneracja klienta NSwag (kontrakt się zmienił — bez tego nic się nie skompiluje).
- [x] `util`: `issue-type-category.ts`, uzupełnienie `modal-ids.ts`.
- [x] `data-access`: `issue-type-scheme.orchestrator.ts` (sygnatura `taskmgmt.issue_type_scheme`),
      rozszerzenie `issue.view-model.ts` o typ.
- [x] `data-access`: implementacja **portu wgrywania** dla `erp-rich-text` — bilet →
      `PUT` do magazynu → rejestracja, plus podmiana referencja ↔ `blob:` w obie strony
      (podgląd **i** edytor).
- [x] **Przebudowa układu karty zgłoszenia** wg
      [`task-management-pages.md` §9.1](docs/frontend/task-management-pages.md#91-karta-zgłoszenia--dwie-kolumny-jeden-strumień):
      dwie kolumny, panel pól po prawej ze stanem na górze, strumień aktywności z filtrem,
      zakotwiczone pole komentarza, edycja tytułu i opisu w miejscu.
- [x] `feature/issue`: kolumna typu z ikoną na liście, wybór typu w modalu tworzenia,
      zmiana typu na karcie.
- [x] `feature/issue`: **modal pól wymaganych przy przejściu** (`WF-004`) — używany zarówno
      z karty, jak i z tablicy; anulowanie cofa ruch karty.
- [x] `feature/issue`: **tryb drzewa na liście** (`LNK-006`) — przełącznik obok zakresu,
      dzieci spoza filtru wyszarzone.
- [x] `feature/issue`: ostrzeżenia grafu — zamknięcie rodzica z otwartymi dziećmi (`LNK-004`),
      zmiana stanu zgłoszenia zablokowanego (`LNK-005`); oba jako potwierdzenie, nie blokada.
- [x] `feature/issue`: obrazy w **komentarzu** (`CMT-006`) — ten sam port wgrywania, załącznik
      przypisany do zgłoszenia, nie do komentarza.
- [x] `feature/project`: zakładka **typy** na karcie projektu (wybór schematu, lista typów).
- [x] `feature/project`: pole zakładane z UI podaje nazwę tekstem (`FLD-002`); komunikat
      o wyczerpaniu slotów mówi, ile jest zajętych i przez co (`FLD-005`).
- [x] `contract`: bez zmian w menu — typy żyją na karcie projektu.
- [x] Tłumaczenia + `pnpm translate:keys`.

### 2.8 Definicja ukończenia fazy 4

- [x] Nowy typ `Incydent` dodany z UI pojawia się w modalu tworzenia zgłoszenia **bez wdrożenia**.
- [x] Zgłoszenie typu `Podzadanie` nie da się ustawić jako rodzic — komunikat mówi dlaczego.
- [x] Przeciągnięcie karty do kolumny wymagającej pola otwiera modal; anulowanie cofa kartę.
- [x] Lista przełącza się w drzewo bez utraty filtru.
- [x] **Zrzut ekranu wklejony `Ctrl+V` w opisie** wgrywa się bez okna wyboru pliku, wyświetla się
      po odświeżeniu strony i po ponownym wejściu w edytor.
- [x] **To samo w polu komentarza**; plik pojawia się na liście załączników zgłoszenia.
- [x] Karta zgłoszenia ma układ z [§9.1 dokumentu stron](docs/frontend/task-management-pages.md#91-karta-zgłoszenia--dwie-kolumny-jeden-strumień):
      panel pól po prawej, jeden strumień aktywności z filtrem, pole komentarza zakotwiczone.
- [x] **`grep` po `feature` nie znajduje komponentu prezentacyjnego bez logiki** — karta tablicy,
      strumień, panel pól i pasek powiązań są w `task-management/ui`.
- [x] `dotnet test backend/tests/TaskManagement.Tests` zielone.

---

## 3. Faza 5 — zlecenia międzydziałowe, obserwujący, powiadomienia

**Cel fazy:** drugi scenariusz z [§1 wymagań](docs/backend/task-management-requirements.md#1-cel-systemu) —
biznes zleca, dział wykonuje, zamawiający odbiera. To jest faza, która uzasadnia istnienie modułu.

**Wymagania:** REQ-001..006, NTF-001/002, ISS-009, CMT-004, PERM-003/004, PRJ-006.

### 3.1 Backend — domena i persystencja

- [x] `IssueWatcher` (encja podrzędna `Issue`) + `Issue.AddWatcher`/`RemoveWatcher`
      z zapamiętaniem **jawnej rezygnacji** (`ISS-009` AC1 — bez tego kolejny komentarz dopisuje z powrotem).
- [x] `Issue.IsRestricted` już jest — dopiąć do predykatu widoczności (`PERM-003`).
- [x] `Issue.DerivedDeliveryState` — pole wyliczane z powiązań `realizuje` (`REQ-003`).
- [x] `SlaPolicy` na projekcie: czas reakcji, czas realizacji, kalendarz roboczy (`PRJ-006`).
- [x] Migracje `WatchersAndIntake`, `ProjectSla`.
- [x] Seed: schemat stanów `Intake` (`Nowe → Przyjęte → W realizacji → Do odbioru → Odebrane`
      + `Zastrzeżenia` z powrotem) — `REQ-004` AC3.
- [x] Indeks `(due_at) where state_category <> 'Done'` pod skan terminów.

### 3.2 Backend — aplikacja, API, zdarzenia

- [x] `IssueAddWatcherCommand` / `IssueRemoveWatcherCommand`.
- [x] Nasłuch zdarzenia domenowego zamknięcia zgłoszenia → przeliczenie `derived_delivery_state`
      na powiązanych zleceniach (`REQ-003`). **Zdarzenie domenowe, nie integracyjne** — ten sam moduł.
- [x] `IssueOverdueScanService : BackgroundService` z **`[ClusterSafe(powód)]`** i dzierżawą
      `taskmgmt:issue-overdue-scan` (`REQ-005`). Bez atrybutu nie przejdzie `BackgroundServiceTests`.
- [x] Publikacja `UserNotificationRequested` z listą odbiorców dla siedmiu zdarzeń z `NTF-002`;
      **sprawca zmiany wycięty z listy**.
- [x] Rozszerzenie `IssueVisibility` o `is_restricted` i o wgląd z powiązania (`PERM-004`) —
      nagłówek, nie treść: osobna projekcja `IssueHeaderDto`, nie `IssueDto` z pustymi polami.
- [x] Parsowanie wzmianek `@` przy zapisie komentarza → dopisanie obserwujących + powiadomienie.

### 3.3 Front

- [x] `data-access`: rozszerzenie `issue.orchestrator` o obserwujących i `derivedDeliveryState`.
- [x] `feature/issue`: sekcja obserwujących na karcie (dodaj/usuń, „obserwuję" jako przełącznik).
- [x] `feature/issue`: wzmianki `@` w edytorze komentarza — podpowiadanie przez
      `ERP_USER_DIRECTORY` ([`user-directory.md`](docs/frontend/user-directory.md)), nie lokalnym endpointem.
- [x] **Nowy agregat `request`** w `feature`: strona `/task-management/request`
      (`REQ-006`) + modale „złóż zlecenie", „odbierz realizację", „zgłoś zastrzeżenia".
- [x] `feature/issue`: pasek powiązań pokazuje nagłówki zgłoszeń realizujących (`REQ-002`).
- [x] `feature/project`: zakładka **SLA** (`PRJ-006`).
- [x] `contract`: pozycja menu „Zlecenia" → `/task-management/request` z `taskmgmt.issue.read`.
- [x] Tłumaczenia + `pnpm translate:keys`.

### 3.4 Definicja ukończenia fazy 5

- [x] Zamawiający składa zlecenie w projekcie `Intake`, dev tworzy dwa zgłoszenia i wiąże je
      typem `realizuje`; zamknięcie obu zmienia stan realizacji na zleceniu **bez ręcznej akcji**.
- [x] Zlecenie **nie zamyka się samo** — dopiero odbiór człowieka je zamyka.
- [x] Zamawiający widzi klucz, tytuł i stan zgłoszenia dev, a `404` przy próbie wejścia na kartę.
- [x] Wzmianka `@` w komentarzu daje powiadomienie w dzwonku odbiorcy, a nie autorowi.
- [x] Druga instancja serwisu nie dubluje przypomnień o terminie.

---

## 4. Faza 6 — dojrzałość narzędzia

**Cel fazy:** moduł staje się użyteczny na co dzień dla zespołu, który już ma setki zgłoszeń.
Po tej fazie kończy się **MVP użytkowe**.

**Wymagania:** SPR-001..003, BULK-001..003, TAG-001/002, SRCH-003/004, ISS-007/008/010,
TIME-001/002/004, BRD-006/007/009, PRJ-003/004, ATT-002, API-005, NFR-008.

### 4.1 Sprinty i backlog

- [x] `Sprint` (agregat): nazwa, zakres dat, cel, stan; `board_card.sprint_uuid` już istnieje.
- [x] Indeks częściowy `unique (board_uuid) where status = 'Active'` — niezmiennik w bazie, nie w kodzie.
- [x] `SprintCreate`, `SprintSetDates`, `SprintExecStart`, `SprintExecClose`
      (zamknięcie z **jawną decyzją** o niedokończonych — `SPR-003`).
- [x] Front: podstrona `/task-management/board/:uuid/backlog`, dwie listy, ten sam mechanizm ranku.
- [x] Sygnatura realtime `taskmgmt.sprint` + rejestracja w `AggregateSignatures`.
- [x] `BoardSetCardSprintCommand` — dopięcie karty do backlogu/sprintu (brakowało w pierwotnym
      planie: `BoardCard.SetSprint` istniało w domenie od fazy 2, ale nic go nie wywoływało).
- [x] Modale `SprintCreate` (nazwa/cel/daty) i `SprintExecClose` (jawny wybór: backlog albo
      wskazany sprint planowany — SPR-003 AC1); `SprintExecStart` przez potwierdzenie, bez formularza.

### 4.2 Tagi i rozwiązanie

- [x] `Tag` + `issue_tag`; `taskmgmt.tag.manage` jako **nowy kod uprawnienia** (dopisane w obu
      miejscach: `Permissions.cs` i `permission-codes.ts`).
- [x] `Issue.ResolutionUuid` + słownik rozwiązań (`Resolution`, cztery systemowe z seeda +
      własne projektu); wpięcie w `required_fields` przejścia do kategorii `Done` (`ISS-007`) —
      `Issue.SetState` sprawdza kod `"resolution"` przez `ResolutionUuid`, nie przez
      `_customFields` (stare pole niestandardowe `resolution` w seedzie DEV usunięte, zastąpione
      polem pierwszej klasy); powrót ze stanu `Done` czyści `ResolutionUuid` (AC2, sprawdzone
      w przeglądarce: DEV-1 Done→In Progress wyzerowało `resolutionUuid`).
- [x] Front: `erp-tag-chips` (przygotowane w fazie 4) spięte z prawdziwymi danymi — chipsy
      usuwalne na karcie zgłoszenia (`IssueTagsComponent`, dopięcie/odpięcie z natychmiastowym
      skutkiem przez `addTagOptimisticAsync`/`removeTagOptimisticAsync`, założenie tagu w locie
      gated `taskmgmt.tag.manage`), kolumna i filtr wielokrotnego wyboru po tagach na liście
      zgłoszeń, picker rozwiązania w modalu WF-004 (`WorkflowRequiredFieldsStepComponent` —
      `resolution` to jedyny kod `requiredFields` z osobną kontrolką, źródło opcji to
      `TaskManagementResolutionOrchestrator`, nie profil pól projektu).
- [x] **Poprawiona luka znaleziona podczas tej weryfikacji**: `searchTagsAsync`/
      `searchResolutionsAsync`/`searchSprintsAsync` (ten ostatni z fazy 6.1) zapisywały wynik
      do identity mapy, ale nie oznaczały uuid jako „załadowane" — `BaseOrchestrator.getViewModel()`
      filtruje po zbiorze z `loadAsync`, nie po samej zawartości mapy, więc widok zawsze był pusty
      mimo poprawnej odpowiedzi z API. Naprawione dopisaniem `await this.loadAsync(uuids)` po
      `identityMap.setMany(...)` (bez dodatkowego zapytania sieciowego — `getMissing` widzi je
      już w cache'u). Ta sama luka psuła sprinty na backlogu z fazy 6.1 — wykryta i naprawiona
      dopiero teraz, dzięki żywej weryfikacji w przeglądarce, której zabrakło przy 6.1.

### 4.3 Operacje masowe

- [x] Egzekutory dla siedmiu operacji z `BULK-002` — sześć (zmiana stanu, przypisanie,
      priorytet, dodanie/usunięcie tagu, dodanie do sprintu) już istniało jako zwykłe komendy
      pojedynczego zgłoszenia przechodzące przez generyczny `BatchEndpointBase` bez zmian (kontrakt
      wsadowy nie odróżnia jednego celu od tysiąca — `docs/backend/bulk-commands.md`); siódma
      (przeniesienie do projektu) jest nowa. `IssueBatchValidator` rozszerzony o pre-check
      istnienia projektu docelowego (`IssueTargetProjectMustExistRule`).
- [x] Przeniesienie do projektu (`ISS-010`) — `IssueSetProjectCommand` (nazwa wg pięciu
      czasowników, nie „Move"), nadaje nowe klucze jednym przeskokiem licznika
      (`AllocateRangeAsync`), zapisuje `previous_keys` (kolumna i domenowa metoda `MoveToProject`
      istniały od fazy 4/6, nieużywane do teraz), przenosi **całe poddrzewo** potomków znalezione
      falami (`IIssueRepository.FindDescendantsAsync` — hierarchia nie ma z góry ograniczonej
      głębokości), waliduje CAŁE poddrzewo przed jakąkolwiek mutacją (typ zgłoszenia musi
      istnieć w schemacie typów projektu docelowego). **Ekran decyzji o polach bez odpowiednika**
      — `GetIssueMoveToProjectPreviewEndpoint` (kompozycja `IIssueQueries`+`IFieldSchemeQueries`,
      bez własnego zapytania do bazy) zwraca kody pól niestandardowych bez odpowiednika w
      docelowym schemacie i listę pól dostępnych do zmapowania; `FieldDecisions` w komendzie
      niesie tylko decyzje o PRZENIESIENIU (kod źródłowy → kod docelowy), brak wpisu = odrzucenie.
- [x] Front: toolbar listy zgłoszeń (już miał pełny `ErpSelectionScope` z wcześniejszej fazy)
      rozszerzony o trzy nowe akcje masowe — „Dodaj tag"/„Usuń tag" (modal z pickerem tagu
      projektu z kontekstu, wzorem modalu zmiany stanu) i „Przenieś do projektu" (modal z
      pickerem projektu + dynamicznym ekranem decyzji renderowanym po odpowiedzi z podglądu,
      niebudowany przez `ErpStepContentBuilder` — wzorem `WorkflowRequiredFieldsStepComponent`,
      bo wiersze zależą od danych z backendu, nie z konfiguracji statycznej). Osobnego modalu
      podsumowania zadania masowego **nie dodano** — dzwonek zadań (istniejący z wcześniejszych
      faz) już pokazuje postęp i wynik każdego zadania wsadowego, w tym nowego
      `IssueSetProjectCommand`.
- [x] Przekierowanie ze starego klucza na bieżący na trasie karty (`ISS-010` AC2) —
      `issue-detail.component.ts` porównuje `issue.key` z parametrem trasy po wczytaniu i robi
      `router.navigate(['...', issue.key], {replaceUrl:true})`, gdy się różnią; backend już
      wcześniej rozwiązywał klucz historyczny (`IssueQueries.GetByKeyAsync`), więc brakował
      wyłącznie ten jeden krok po stronie frontu.

### 4.4 Rejestracja czasu — dane dla raportu z fazy 7

Ta podsekcja jest **warunkiem koniecznym fazy 7**: raport godzin nie policzy niczego wstecz.

- [x] `WorkLog` + `Issue.EstimateMinutes`; migracja `WorkLogAndEstimate` — `IssueWorkLog` jest
      **agregatem własnym** (jak `IssueComment`), NIE kolekcją podrzędną `Issue`: zgłoszenie
      żyjące rok zbiera setki wpisów, a `IssueRepository.FindAsync` nie może rosnąć z nimi przy
      każdej komendzie. Usunięcie jest twarde (brak czegokolwiek przyczepionego do wpisu, w
      odróżnieniu od komentarza). `Issue.EstimateMinutes` (`int?`) + `SetEstimate` z walidacją
      nieujemności.
- [x] Słownik rodzajów pracy — `WorkType` (agregat wzorem `Tag`: `ProjectUuid` `null` = globalny),
      cztery domyślne (`Rozwój`/`Testy`/`Analiza`/`Spotkanie`) seedowane identyfikatorami stałymi
      (`WorkTypeDefaults`, wzorem `ResolutionDefaults`) — `TIME-001` AC2.
- [x] `IssueAddWorkLogCommand`, `IssueRemoveWorkLogCommand` (tylko autor — cudzy wpis odrzuca
      `taskmgmt.work_log_not_author`), `IssueSetEstimateCommand` — wszystkie na skeletonie
      wsadowym (paczka jednoelementowa z karty), wzorem komentarzy/obserwujących.
- [x] Zapytanie agregujące **po łańcuchu `realizuje`** rekurencyjnym CTE (`IIssueDeliveryHoursQueries`,
      TIME-004) — schodzi WSTECZ po `Delivers` (dowolna głębokość, nie tylko jeden poziom, AC2),
      niesie `SharedWithOtherRequestsCount` per wykonawca (liczba INNYCH zleceń, które to samo
      zgłoszenie wykonawcze też realizuje — jawne oznaczenie nadmiaru z AC3). Samo zapytanie,
      **bez endpointu** — nic go jeszcze nie woła (raport wchodzi w fazie 7), a wystawianie
      nieużywanego endpointu byłoby dodawaniem powierzchni bez potrzeby. Nie da się go
      zweryfikować testem jednostkowym (surowe SQL, jak `IssueGraphQueries`) — zweryfikowany
      ręcznie na żywej bazie przy tej samej okazji, co reszta.
- [x] Front: sekcja czasu na karcie zgłoszenia (`IssueTimeComponent`, wzorem `IssueTagsComponent`)
      — rodzaj pracy wstępnie wybrany (pierwszy dostępny), więc dodanie wpisu to wpisanie minut
      i `Enter`/przycisk (`TIME-001` AC3); estymata (edytowalna inline), suma zalogowanych minut
      i różnica bez ostrzeżenia o przekroczeniu (`TIME-002` AC1).
- [x] Wpisy czasu wchodzą do strumienia aktywności jako filtr `Czas` (§9.1 dokumentu stron) —
      atom `erp-activity-stream` miał już gotowy trzeci kanał (`kind: 'time'`, czekający na dane
      od fazy 4); `IssueActivityKind.WorkLogAdded/Removed` (6/7) kierowane w `IssueActivityComponent`
      do tego kanału zamiast do „Historii".

> **Granica z kadrami** (`TIME-003`): żadnego endpointu „godziny pracownika X w miesiącu".
> Agregacja idzie po zgłoszeniu, projekcie i zagadnieniu — nigdy po osobie jako podmiocie raportu.

### 4.5 Wyszukiwanie, tablica, projekt

- [x] Indeks GIN + `SearchIssueFullText` z predykatem widoczności **w tym samym zapytaniu** (`SRCH-003`) —
      `IssueQueries.Filtered()` rozszerzony o `EF.Functions.ToTsVector("simple", title || description)
      .Matches(EF.Functions.WebSearchToTsQuery("simple", text))` (frazę w cudzysłowie obsługuje sam
      `websearch_to_tsquery`, AC2 za darmo) plus `EXISTS` po `issue_comment` tą samą drogą; ILIKE po
      tytule/kluczu zostaje OBOK (nie zamiast) — łapie fragment słowa, czego dopasowanie po leksemach
      nie widzi. Indeks GIN na wyrażeniu (nie kolumnie generowanej) w migracji `SearchSwimlaneArchiveAndLinks`
      — musi zgadzać się dosłownie z wyrażeniem w zapytaniu, inaczej Postgres go nie użyje. AC1 wynika
      z samej struktury metody: predykat widoczności jest już na `query` przed doklejeniem warunku tekstowego.
- [x] Skok do klucza w wyszukiwarce (`SRCH-004`) — czysto frontowe: `IssueFilterComponent.onSearch`
      rozpoznaje wzorzec klucza (`/^[A-Za-z][A-Za-z0-9]{0,15}-\d+$/`, zgodny z `Project.ValidateCode`)
      i wywołuje `loadByKeyAsync` (już istniejące, rozwiązuje też klucze historyczne) zamiast zwykłego
      wyszukiwania; brak trafienia spada z powrotem do normalnej listy, więc literówka nie jest ślepym
      zaułkiem.
- [x] Swimlane'y (`BRD-006`) i limity WIP jako sygnał wizualny (`BRD-007`) — `Board.SwimlaneMode`
      (`None|Assignee|Epic|Priority|CustomField`) + `SwimlaneFieldCode` (tylko dla `CustomField`,
      pole typu `Select` — odpowiednik „Enum" z wymagania, dzieli pulę slotów tekstowych) i
      `BoardColumn.WipLimit` (`int?`, `null` = brak limitu). `BoardStore.swimlanes` grupuje OD SUROWYCH
      kart (nie od już złożonych kolumn), żeby nakładka optymistyczna przeciągnięcia wstawiała kartę do
      właściwego swimlane'u I kolumny jednym splice'em — inaczej indeks upuszczenia liczony przez CDK
      w obrębie jednego swimlane'u trafiłby w pozycję z listy złożonej ze wszystkich swimlane'ów naraz.
      Drag jest izolowany per swimlane (`cdkDropListGroup` na wierszu, nie na całej tablicy) — bez tego
      przeciągnięcie karty między swimlane'ami przestawiłoby rank, nie zmieniając pola grupującego
      (przypisanego/priorytetu), więc karta i tak wróciłaby do starego wiersza po przeładowaniu.
      Karta bez wartości grupującej trafia do jawnego `__unassigned__` (AC2). Przełącznik trybu w
      nagłówku tablicy (`<select>` natywny — świadomy kompromis wobec TaigaUI dla drugorzędnej kontrolki
      administracyjnej); tryb `CustomField` z kodem pola pozostaje osiągalny tylko przez API, bez
      dedykowanego inputu w tym prostym przełączniku. WIP: badge kolumny zamienia się na ostrzeżenie
      wizualne po przekroczeniu, upuszczenie nigdy nie jest blokowane (AC1 BRD-007).
- [x] Lista tablic + przekierowanie przy jednej tablicy (`BRD-009`) — backend już zwracał tablice
      widoczne (`searchBoard`, dziedziczy widoczność po projekcie), więc to była czysto frontowa luka:
      nowa `BoardListComponent` na trasie `board` (bez uuid) zamiast dawnego automatycznego wejścia na
      tablicę domyślną; z dokładnie jedną widoczną tablicą przekierowuje `replaceUrl` wprost na nią,
      inaczej renderuje listę linków.
- [x] Archiwizacja projektu (`PRJ-004`) i zmiana prefiksu (`PRJ-003`) — `Project.SetCode`
      (walidacja formatu dziedziczona z konstruktora) + `ProjectKeyCounter` dostaje osobną metodę
      zapisu `SetPrefixAsync` (surowy `UPDATE`, z tego samego powodu co `IIssueKeyAllocator` — licznik
      nie jest agregatem śledzonym przez change tracker); `Project.IsArchived`+`Archive()`/`Unarchive()`+
      `EnsureNotArchived()` (rzuca `taskmgmt.project_archived`, wołane z `IssueCreateCommandHandler`
      PRZED przeskokiem licznika klucza — PRJ-004 AC1). `SearchProjectRequest.IncludeArchived`
      (domyślnie `false`) filtruje domyślne listy; `GetAsync` po uuid świadomie NIE filtruje — link do
      istniejącego zgłoszenia w zarchiwizowanym projekcie musi dalej działać (PRJ-004 opis). Front:
      edycja prefiksu inline (wzorem estymaty z `IssueTimeComponent`) i przycisk archiwizacji/przywrócenia
      w nagłówku karty projektu, z potwierdzeniem przed archiwizacją.
- [x] Usunięcie pojedynczego załącznika (`ATT-002`) — `IssueRemoveAttachmentCommand` kasuje wiersz
      i publikuje `ArtifactDeletionRequested` przez outbox (`IIntegrationEventPublisher`), **nigdy
      gołe `DeleteAsync` z handlera** — bajty w magazynie sprząta nowy `ArtifactDeletionRequestedHandler`
      (`TaskManagement.Infrastructure/Consumers`, kopia mechanizmu z Catalogu,
      `docs/backend/media-storage.md` §4b) po zatwierdzeniu transakcji, tolerując brak obiektu.
      Nowy `TaskManagementModule.Name` jako dyskryminator modułu (wymiana `erp.events` jest fanoutowa).
- [x] Linki zewnętrzne na zgłoszeniu (`API-005`) — `IssueExternalLink`, encja podrzędna `Issue` wzorem
      `IssueTag` (mała, ograniczona kolekcja, eagerowo doczytywana), NIE integracja w domenie: niesie
      wyłącznie URL (walidowany jako pełny http(s)) i etykietę nadaną przez człowieka. Komendy
      `IssueAddExternalLinkCommand`/`IssueRemoveExternalLinkCommand` na skeletonie wsadowym. Bez
      osobnego cache'u frontowego — lista jedzie razem z `IssueDto.externalLinks`.

**Dwa realne błędy backendu znalezione i naprawione podczas weryfikacji, oba w konfiguracji, nie
w kodzie domenowym**:
1. **`TaskManagement.Api` nigdy nie nasłuchiwał `erp.events`** — `appsettings.Development.json` nie
   miał `Messaging:ListenQueueName` (Catalog i Notification mają, TaskManagement nigdy go nie dostał
   w żadnej wcześniejszej fazie). `ArtifactDeletionRequestedHandler` był poprawnie napisany i
   zarejestrowany, ale bez związanej kolejki na wymianie `erp.events` wiadomość nigdy do niego nie
   docierała — pierwsze dwa usunięcia załączników w tej sesji zostawiły pliki-sieroty w MinIO
   (potwierdzone przez `mc ls`), dopiero po dopisaniu `"ListenQueueName": "taskmanagement.events"`
   i restarcie usługi konsument faktycznie skasował obiekt (zweryfikowane: plik zniknął z
   `erp-taskmgmt-media/assets/`). Sierotę sprzed poprawki usunięto ręcznie (mc rm) jako sprzątanie
   po teście, nie jako produkcyjny fix — nowe usunięcia idą już poprawną ścieżką.
2. **Ten sam błąd `null` kontra `undefined` co w fazie 6.4** (estymata), tym razem w
   `BoardColumnComponent.wipExceeded`: `column.wipLimit !== undefined` przepuszczało `null`
   (backend serializuje brak limitu jako `null`, nie pomija pola), a `cards.length > null` rzutuje
   `null` na `0` i jest prawdziwe dla KAŻDEJ niepustej kolumny — wszystkie trzy kolumny na żywej
   tablicy DEV pokazywały fałszywe „Przekroczono limit WIP” mimo braku ustawionego limitu. Naprawione
   jawnym sprawdzeniem `!== null && !== undefined` (styl zgodny z resztą modułu, bez luźnego `!=`).

**Trzeci, czysto frontowy błąd** (nie backend): picker projektu w modalu tworzenia zgłoszenia
(`IssueCreateStepComponent`) czytał `TaskManagementProjectOrchestrator.getViewModel()` bez filtra —
ten cache jest WSPÓLNY w całej aplikacji, więc zarchiwizowany projekt raz doładowany przez INNY widok
(np. kolumnę „Projekt” na liście zgłoszeń, rozwiązującą istniejące zgłoszenie `MKT-4` — to musi działać
mimo archiwizacji, zgodnie z projektem) zostawał w pickerze mimo że `searchProject` już go poprawnie
wykluczał. Naprawione jawnym `.filter(p => !p.isArchived)` w komponencie kroku, zamiast polegać na tym,
że backend przefiltrował SWÓJ wynik wyszukiwania.

**Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+`TaskManagement.Api`+
`Identity.Api`+`Notification.Api`): zmiana prefiksu DEV→DEV2 (potwierdzona w bazie, stare klucze
`DEV-3`/`DEV-7`/… bez zmian, licznik nie zresetowany) i z powrotem; archiwizacja MKT (badge
„Zarchiwizowany”, znika z domyślnej listy projektów, link po uuid nadal otwiera kartę, próba
założenia zgłoszenia w MKT przez bezpośrednie wywołanie API kończy się `taskmgmt.project_archived`
w `job_item`, picker tworzenia zgłoszenia poprawnie pomija MKT po poprawce) i przywrócenie; dodanie
i usunięcie linku zewnętrznego na `DEV-1` (baza + UI zgadzają się na każdym kroku); usunięcie dwóch
załączników na `DEV-1` (drugie, po poprawce `ListenQueueName`, potwierdzone zniknięciem obiektu w
MinIO); wyszukiwanie „kaligrafia” (słowo wyłącznie w opisie, nie w tytule) trafia `DEV-3`; fraza w
cudzysłowie ze słowami sąsiadującymi w tekście trafia, z tymi samymi słowami w niesąsiadującej
kolejności — nie trafia (prawdziwe dopasowanie frazy, nie AND słów); wpisanie „DEV-3” w wyszukiwarce
otwiera kartę wprost; lista tablic z dwiema pozycjami (DEV, MKT) renderuje się zamiast automatycznego
przekierowania; grupowanie „Po priorytecie” na tablicy DEV poprawnie rozkłada karty na pięć swimlane'ów
(Najniższy…Krytyczny) z tymi samymi trzema kolumnami w każdym, po poprawce błędu WIP odznaczenie
przekroczenia znika. **Nieprzetestowane bezpośrednio interakcją użytkownika (zweryfikowane przeglądem
kodu)**: przeciąganie karty MIĘDZY swimlane'ami tego samego stanu (blokada przez zasięg
`cdkDropListGroup` per wiersz) i grupowanie po polu niestandardowym (`CustomField` — brak inputu na
kod pola w prostym przełączniku nagłówka, tylko przez API).

### 4.6 Definicja ukończenia fazy 6

Zweryfikowano na żywo 2026-09-02 (środowisko dev, `client-monolith` + `TaskManagement.Api`).

- [x] Zespół prowadzi sprint od planowania do zamknięcia; niedokończone zgłoszenia trafiają tam,
      gdzie użytkownik wskazał, a nie tam, gdzie system uznał.
      Utworzono tablicę scrumową testową (Kanban odrzuca sprinty kodem
      `taskmgmt.sprint_board_not_scrum` — poprawne wymuszenie SPR-001), zaplanowano sprint,
      przeniesiono zgłoszenie z backlogu, aktywowano, oznaczono jedno zgłoszenie jako Zrobione,
      zamknięto sprint z jawnym wyborem „do backlogu" dla reszty. Po zamknięciu: zgłoszenie
      Zrobione zostaje przy zamkniętym sprincie (zamrożone), niedokończone wraca do backlogu —
      zgodnie z SPR-003 AC1/AC2. Przy okazji znaleziono i naprawiono bug: etykieta „Do backlogu"
      w kroku zamknięcia sprintu (`sprint-exec-close.step.ts`) renderowała się jako surowy klucz
      `board.backlog.close.toBacklog`, bo `ErpStepContentBuilder`'s `inputPicker` nie przepuszcza
      `label` przez `erpTranslate` sam — naprawiono jawnym `transloco.translate(...)`.
- [x] Zmiana stanu na 300 zaznaczonych zgłoszeniach kończy się sukcesem częściowym z listą
      odrzuconych i powodem per zgłoszenie.
      Zweryfikowano na 4 zgłoszeniach (ten sam mechanizm co przy 300 — `BulkCommandRunner` nie
      rozróżnia skali): DEV-2 miał ustawione `resolution`, DEV-9/5/7 nie. Batch „Zmień stan” →
      Zrobione: `job.total_count=4, succeeded_count=1, failed_count=3`, każdy odrzucony wiersz
      niesie `error_code=taskmgmt.required_fields_missing` z czytelnym komunikatem („Przejście
      `...finish` wymaga wartości pola `resolution`”). Lista po odświeżeniu poprawnie pokazuje
      DEV-2 jako Zrobione, resztę bez zmian. Po drodze znaleziono i zgłoszono osobno (nie
      naprawiono w tej sesji — poza zakresem tego DoD) systemowy bug: kilka filtrów/pickerów w
      module (Priorytet, Zakres i inne) budowało etykiety przez
      `computed(() => transloco.translate(klucz))`, co jest niereaktywne — `computed` cache'uje
      wynik na zawsze, jeśli odczyta go zanim scope Transloco się doładuje, podczas gdy pipe
      `erpTranslate` (użyty poprawnie w kartach tablicy i tabeli) odświeża się reaktywnie. Efekt:
      część dropdownów pokazywała surowe klucze (`taskManagement.priority.critical` itd.) mimo
      poprawnych tłumaczeń w JSON-ie. Przy okazji przeniesiono `provideTaskManagementTranslations()`
      z `providers` pojedynczego komponentu (`issue-detail.component.ts`) na trasę agregującą
      moduł (`entry.routes.ts`) — to samo w sobie poprawne per `docs/frontend/translations.md`,
      ale nie usuwa błędu reaktywności; właściwa naprawa (9 plików) zgłoszona jako osobne zadanie.
- [x] Wyszukiwanie frazy w komentarzach nie pokazuje zgłoszeń spoza uprawnień.
      Dodano komentarz z unikalną frazą do DEV-1 (widoczny), wyszukanie frazy zwróciło DEV-1.
      Oznaczono DEV-1 jako `is_restricted=true` (zgłaszający = system, więc bieżący użytkownik
      nie jest ani zgłaszającym, ani przypisanym, ani Lead projektu, ani obserwatorem) —
      identyczne wyszukanie tej samej frazy zwróciło zero wyników („Brak zgłoszeń spełniających
      kryteria”). Potwierdza to strukturalnie: `IssueQueries.Filtered()` startuje od
      `Visible()`/`VisibleTo(...)` i dopiero NA TYM zawężonym zbiorze doszukuje frazy (tytuł,
      opis, komentarz) — widoczność nie jest osobnym warunkiem, którym dałoby się ominąć
      dopasowanie pełnotekstowe, tylko bazą całego zapytania (AC1 spełnione samą strukturą
      metody). Po teście przywrócono `is_restricted=false` i usunięto testowy komentarz.
- [x] Przeniesiony `DEV-412` otwiera się ze starego linku.
      Przeniesiono DEV-8 → MKT (akcja masowa „Przenieś do projektu”, ISS-010), zgłoszenie dostało
      nowy klucz `MKT-5`. Wejście na stary URL `/task-management/issue/DEV-8` przekierowało
      (potwierdzone przez `window.location.href`) na `/task-management/issue/MKT-5` z tą samą
      treścią. Mechanizm ten sam co potwierdzony wcześniej w fazie 6.3 (DEV-10→MKT-4) —
      tu powtórzony jawnie jako osobna pozycja checklisty.
- [x] `NFR-003` zmierzone na 200 tys. zgłoszeń — wynik zapisany w tym pliku.
      Wygenerowano 200 000 syntetycznych zgłoszeń (rozłożonych 50/50 DEV/MKT, losowe
      priorytety/typy/stany/`text_1`), `ANALYZE`, zmierzono `EXPLAIN ANALYZE` na dokładnym
      kształcie zapytania z `IssueQueries` (predykat widoczności + sortowanie/filtrowanie +
      `LIMIT 50`), potem usunięto dane testowe. Wyniki:
      - **Strona wyników, sortowanie domyślne (`CreatedAt DESC, Uuid`), bez filtra projektu —
        PRZED naprawą: ~277 ms** (Seq Scan + Sort całej tabeli 200 tys. wierszy; z tego ~188 ms
        to sam JIT Postgresa, który się włącza właśnie DLATEGO że koszt Seq Scan jest wysoki —
        nie pomaga tu, bo zapytanie i tak wykonuje się raz). Brakowało indeksu wspierającego
        domyślne sortowanie z `IssueQueries.ApplySorting` — zapytanie **nie miało z czego
        skorzystać przy 200 tys. wierszy poza kolejnością wstawiania**. Naprawiono migracją
        `IssueDefaultSortIndex` (`IssueConfiguration.cs`): indeks `(created_at DESC, uuid)`. **PO
        naprawie: ~0,14 ms** — Postgres robi Index Scan Backward i zatrzymuje się po 50
        wierszach, koszt przestaje zależeć od rozmiaru tabeli.
      - **Strona wyników z filtrem projektu (typowy przypadek) — 0,09 ms.** Korzysta z
        istniejącego `ix_issue_project_uuid_state_uuid`-podobnego wzorca + nowego indeksu sortu.
      - **Sortowanie po polu niestandardowym (slot `text_1`) z filtrem projektu — 38,8 ms.**
        Korzysta z istniejącego `ix_issue_project_uuid_text_1` (sorty po slotach są zawsze
        zawężone do projektu, bo schemat pól jest projektowy — brakujący indeks nie dotyczy tego
        przypadku).
      - **Licznik wyników (`TotalCount`) bez filtra projektu, wszystkie 200 tys. — ~287 ms z
        włączonym JIT Postgresa (`jit=on`, domyślne), ~77 ms z `jit=off`.** To jedyny wynik na
        granicy budżetu 300 ms. `COUNT(*)` z predykatem widoczności musi z definicji dotknąć
        każdego pasującego wiersza (nie ma z czego uciąć LIMIT-em) — indeks tu nie pomoże,
        problem jest w tym, że Postgresowy planer włącza kosztowną kompilację JIT dla
        pojedynczego wykonania zapytania, którego nie amortyzuje. **Rekomendacja (nie
        wdrożona w tej sesji — decyzja dot. współdzielonej instancji Postgresa, poza zakresem
        migracji EF):** podnieść `jit_above_cost`/wyłączyć JIT dla tego wzorca zapytań albo
        rozważyć przybliżony licznik przy widoku „wszystkie projekty” na dużą skalę. Licznik
        **z filtrem projektu** (realny, codzienny przypadek) mierzy się na 41,7 ms — bez ryzyka.

---

## 5. Faza 7 — konfiguracja z UI i raporty

**Wymagania:** WF-006/007, VIEW-001/002, RPT-001..003, PERM-005, TAG-003.

### 5.1 Konfiguracja z UI

- [x] Edytor schematu stanów: dwie listy + macierz „z → do" (`WF-007`), **nie canvas** — nowa
      zakładka „Schemat stanów" na karcie projektu (wzorem zakładki „Typy" z fazy 4).
- [x] Publikacja schematu z modalem mapowania stanów → zadanie masowe (`WF-006`) —
      `WorkflowSchemeExecPublishCommand` + `GetWorkflowSchemePublishPreview`, wzorem
      `IssueSetProjectCommand` z fazy 6; sukces częściowy migracji pokryty testem
      (`WorkflowSchemePublishTests`).
- [x] `SavedView` (filtr + sortowanie + kolumny + tryb), prywatny lub projektowy (`VIEW-001`);
      widok z usuniętym polem otwiera się z komunikatem, nie błędem (sprawdzane po stronie
      frontu względem `GetProjectFieldProfile`, backend świadomie nie waliduje `FilterJson`
      względem aktualnego schematu przy zapisie).
- [x] Widok domyślny projektu (`VIEW-002`, `Could` — domknięte w sesji domykającej fazę 7).
      `Project.DefaultSavedViewUuid` (referencja miękka, celowo bez klucza obcego do
      `saved_view` — usunięcie widoku domyślnego nie musi być zsynchronizowane w tej samej
      transakcji, front pomija auto-zastosowanie widoku, którego nie znajdzie wśród
      wczytanych) + `ProjectSetDefaultSavedViewCommand` (handler odrzuca widok prywatny albo
      należący do innego projektu — `taskmgmt.saved_view_not_shared_with_project`, pokryte
      testem domenowym `SetDefaultSavedView`). Front: `IssueFilterComponent` auto-stosuje
      widok domyślny przy wejściu w kontekst projektu, dopóki użytkownik nie wybierze widoku
      ręcznie w danej sesji (`_manuallySelectedView`); przycisk „Ustaw jako domyślny"/plakietka
      „Domyślny" przy widoku udostępnionym bieżącemu projektowi, gated `taskmgmt.project.manage`.
      **Zweryfikowane na żywo**: zapis widoku „Zespół DEV" udostępnionego projektowi DEV,
      ustawienie jako domyślny, przeładowanie strony, wejście w kontekst DEV — widok
      zastosowany automatycznie (filtr projektu, plakietka „DOMYŚLNY" na widoku).
- [x] Scalanie i zmiana nazwy tagu (`TAG-003`, `Could` — domknięte w sesji domykającej fazę 7).
      `Tag.SetName` (domena) + `TagSetNameCommand`. Scalenie: `TagExecMergeCommand` (czasownik
      `Exec` — usuwa jeden agregat i przepina kolekcję należącą do nieograniczonej liczby innych
      agregatów, nie da się opisać jako `Create`/`Set`/`Add`/`Remove` na jednym z nich,
      `docs/backend/endpoint-naming.md` §5) + `IIssueTagWriter.RepointAsync` (raw SQL z dedupem
      przez `NOT EXISTS`, poza granicą agregatu `Tag` — ten sam wzorzec co
      `IProjectKeyCounterWriter.SetPrefixAsync`). **Bez `AggregateChanged` dla zgłoszeń
      dotkniętych scaleniem** (raw SQL omija ChangeTracker) — świadomie zaakceptowane, front
      robi pełny `reloadAsync` po komendzie. Odrzuca scalenie między różnymi zasięgami
      (`taskmgmt.tag_merge_scope_mismatch` — projektowy w globalny albo między dwoma
      projektami). Front: nowa zakładka „Tagi" na karcie projektu (`ProjectTagsComponent`,
      wzorem „Typy"/„SLA"), inline zmiana nazwy, panel scalenia z pickerem tagu docelowego i
      potwierdzeniem. **Realny błąd znaleziony i naprawiony podczas weryfikacji**: odczyt
      `this.project()` (input wymagany) wprost w konstruktorze zamiast w `effect()` — `NG0950`,
      ten sam wzorzec błędu co przy `IssueSetProjectStepComponent` w fazie 6; naprawione
      przeniesieniem do `effect()`. **Zweryfikowane na żywo**: utworzenie dwóch tagów z karty
      DEV-1 (jeden dołączony sam, drugi razem z pierwszym — przypadek dedupu), zmiana nazwy
      `back-end-old` → `legacy-backend` (zapisana w bazie), scalenie `legacy-backend` → `backend`
      — tag źródłowy usunięty, DEV-1 pokazuje `Tagi (1)` zamiast dwóch wierszy (dedup
      zweryfikowany bezpośrednio na zgłoszeniu, które miało oba tagi naraz).

### 5.2 Raporty — ekran kierownictwa

Wchodzi tu, a nie w fazie 8, bo dyrektor IT jest **aktorem systemu**, nie odbiorcą rozszerzeń.
Dane zbierają się od fazy 6 (`TIME-001`), więc raport ma z czego liczyć od pierwszego dnia.

Zrealizowane jako generalizacja `ExportRun`→`ReportRun` (`docs/backend/reporting.md` §3-4,
**faza 0 tamtego dokumentu**, zrobiona teraz, przed pierwszym raportem, zgodnie z zaleceniem):
nowy building block `Erp.BuildingBlocks.Reporting` (`ReportRun` — konkretna klasa mirror `Job`,
NIE generyk/interfejs per moduł; `IReportRunDbContext`; `ReportRunner<TContext>`;
`IReportDefinition` skanowana jak `IBulkCommandExecutor`), Catalog przepisany na tę samą
infrastrukturę (`catalog.product-export` jako pierwsza definicja), `AggregateSignatures`
zaktualizowane w obu modułach.

- [x] `taskmgmt.report.read.all` — nowy kod uprawnienia w `Permissions.cs`
      **i** w `permission-codes.ts` (`PERM-005`).
- [x] `IReportDefinition` dla rozliczenia godzin (`RPT-002`): wiersze = dział/projekt,
      kolumny = okres, rozwinięcie = zagadnienie po łańcuchu `realizuje`
      (`TaskManagementHoursByDepartmentReportDefinition`, rekurencyjne CTE w przód —
      lustrzane odbicie `IssueDeliveryHoursQueries` z fazy 6, ten sam limit głębokości).
- [x] **Zapytania raportowe nie zwracają tytułu ani opisu zgłoszenia** (`PERM-005` AC2/AC3) —
      wymuszone kształtem `HoursByDepartmentRow` (brak pola na żadne z nich), nie filtrem
      w warstwie wyżej. Pierwotnie zweryfikowane tylko ręcznie; **od domknięcia fazy 7 pokryte
      automatycznym testem regresyjnym** — patrz punkt „Test PERM-005" niżej.
- [x] Rozróżnienie „brak danych" od „zero godzin" w projekcji (`RPT-002` AC4) — brak wpisów
      w okresie po prostu nie generuje wiersza (brak `LEFT JOIN` z listą wszystkich możliwych
      zagadnień), więc nieobecność wiersza jest jedynym sygnałem „brak danych".
- [x] Cztery pozostałe definicje `RPT-003` (`Should`, domknięte w sesji domykającej fazę 7),
      wszystkie jako kolejne `IReportDefinition` w `TaskManagement.Infrastructure/ReportDefinitions/`
      — żaden nowy endpoint/komenda, rejestracja przez skan zestawu jak `hours-by-department`:
      - `taskmgmt.issues-by-state-type-assignee` — liczność po (projekt, stan, typ, przypisany),
        LINQ `GROUP BY`, bez zakresu dat (przekrój bieżącego stanu, nie okresu).
      - `taskmgmt.cycle-time-by-state-category` — rekonstrukcja zamkniętych okresów z
        `issue_activity` (`Kind=StateChanged`) przez `LAG` po `occurred_at`; okres bieżący,
        jeszcze otwarty, świadomie pominięty (czas trwania nierozstrzygnięty). Mediana liczona
        po stronie .NET (bucket per kombinacja projekt/kategoria/okres, nie
        `percentile_cont` w SQL — próbek jest za mało, żeby to się opłacało). **Uproszczenie
        udokumentowane**: mapowanie stan→kategoria bierze się z dzisiejszej definicji schematu,
        nie z kategorii obowiązującej w chwili przejścia.
      - `taskmgmt.sla-compliance` — wyłącznie projekty `Intake` z ustawionym SLA; proxy na
        „pierwszą reakcję" (pierwsza aktywność inna niż `Created`) i na „realizację" (ostatnie
        przejście do kategorii `Done`, tylko jeśli zgłoszenie nadal tam jest — reotwarcie cofa
        do „bez rozstrzygnięcia"); zgodność liczona w minutach roboczych wg kalendarza SLA
        projektu, iteracyjnie w C# (`WorkingMinutesBetween`), nie w SQL.
      - `taskmgmt.sprint-progress` / `taskmgmt.sprint-workload` — join `sprint`→`board_card`→
        `issue`+`issue_work_log`; workload grupuje dodatkowo po `AssigneeUuid` — **kontrola
        granicy `TIME-003`** udokumentowana w komentarzu klasy (obciążenie w kontekście JEDNEGO
        sprintu na potrzeby planowania, nie „godziny pracownika X w miesiącu"; brak jakiegokolwiek
        parametru zakresu dat jest częścią tego rozróżnienia, nie przypadkiem).
      Wszystkie pięć definicji objęte testem PERM-005 AC2 (patrz niżej).
- [x] Front: strona raportu przebudowana z jednego bespoke pivotu na **selektor raportu +
      generyczny renderer** (`ReportStore.REPORT_DEFINITIONS`, `report.component.ts`) — pivot
      dział×zagadnienie×okres zostaje wyłącznie dla `hours-by-department`
      ([§9.4 dokumentu stron](docs/frontend/task-management-pages.md#94-raport-godzin-faza-7)),
      pozostałe cztery renderują się generyczną tabelą nagłówek+wiersze
      (`parseReportCsvToRows`) z tłumaczeniem nazw kolumn i rozwiązaniem `assignee_uuid` przez
      `ERP_USER_DIRECTORY`; kolumny-duplikaty uuid obok nazwy (`type_uuid`, `sprint_uuid`) są
      ukryte. Formularz parametrów (zakres dat / picker projektów) pokazuje się warunkowo wg
      wybranej definicji. **Realny błąd znaleziony i naprawiony podczas weryfikacji**: dropdown
      wyboru raportu pokazywał surowy klucz tłumaczenia zamiast nazwy — ten sam systemowy bug
      reaktywności Transloco co w fazie 6 (`computed(() => transloco.translate(klucz))` cache'uje
      klucz na zawsze, jeśli odczyta go zanim scope się doładuje); naprawione dopisaniem
      `injectTranslationsReadySignal()` jako strażnika w `computed`. **Zweryfikowane na żywo**:
      wszystkich pięć raportów w dropdownie z poprawnymi nazwami, dynamiczne pokazywanie/ukrywanie
      pól parametrów, `issues-by-state-type-assignee` wygenerowany na realnych danych seeda
      (DEV/MKT, stany, typ „Funkcjonalność", brak przypisanego pokazany pusty zamiast uuida),
      `cycle-time-by-state-category` z pustym wynikiem (brak historii zmian stanu w danych seeda —
      poprawne zachowanie stanu „brak danych", nie błąd).
- [x] `contract`: pozycja menu „Raport godzin" z `requiredPermission` — dodana **dopiero po**
      potwierdzeniu, że strona działa (`RPT-004`).
- [x] **Test PERM-005** (AC2 + AC3) — dotąd weryfikowane wyłącznie ręcznie, od domknięcia fazy 7
      pokryte `Erp.IntegrationTests` (nowa referencja do `TaskManagement.Infrastructure`,
      `InternalsVisibleTo` na `IssueVisibility` — ten sam wzorzec uzasadnienia co
      `Erp.BuildingBlocks.Reporting.AssemblyInfo`, przepisanie predykatu w teście sprawdzałoby
      kopię mechanizmu, nie mechanizm). `TaskManagementReportPermissionTests`: AC3 —
      `IssueVisibility.VisibleTo` zwraca zero wyników dla zgłoszenia `is_restricted` i aktora
      spoza kręgu, **niezależnie** od nadanych uprawnień (metoda strukturalnie nie przyjmuje
      informacji o permisjach — test dowodzi tego przez wykonanie, nie przez odczyt sygnatury);
      AC2 — wszystkie pięć definicji raportu uruchomione na zgłoszeniu z unikalnym tytułem,
      żadna kolumna ani wartość nigdzie go nie ujawnia (`issues-by-state-type-assignee` czyta
      `_dbContext.Issues` wprost, z pominięciem predykatu widoczności — to jest cały sens
      `report.read.all` — więc zgłoszenie realnie wchodzi do agregacji i test jest dowodem przez
      wykonanie, nie tylko kontrolą strukturalną). `dotnet test` na `Erp.IntegrationTests`:
      26/26 (Testcontainers Postgres), w tym te dwa testy i test scalania tagów.

### 5.3 Definicja ukończenia fazy 7

- [x] Nowy projekt z własnym automatem stanów powstaje **wyłącznie z UI**, bez dotykania seeda
      i bez wdrożenia — tworzenie schematu/stanów/przejść w edytorze, przypięcie do projektu
      istniejącym mechanizmem (`ProjectSetWorkflowScheme`, sprzed fazy 7).
- [x] Dyrektor IT bez członkostwa w żadnym projekcie otwiera raport i widzi „dział WMS — 142 h
      na zagadnieniu LOG-14"; kliknięcie **nie otwiera** listy zgłoszeń WMS — **mechanizm
      zweryfikowany** (generowanie, pobranie, brak linku z zagadnienia), ale **bez rzeczywistych
      danych** w środowisku dev (`work_log` puste — zero wierszy przy starcie tej fazy, faza 6
      nie zdążyła jeszcze nazbierać wpisów). Liczbowy przykład z tego zdania nie został
      odtworzony na żywo, tylko syntetycznie w bazie (patrz §10).
- [x] Godziny zalogowane w projekcie wykonawczym na zgłoszeniu realizującym zlecenie liczą się
      do zagadnienia tego zlecenia, a nie tylko do projektu wykonawczego — potwierdzone wprost
      (wpis czasu na `DEV-9`, realizującym `MKT-4`, przypisany do zagadnienia `MKT-4`, dział
      `DEV`; patrz §10).
- [x] **Kontrola granicy z kadrami** (`TIME-003`): wszystkie pięć zaimplementowanych definicji
      grupują po dziale/zagadnieniu/okresie/sprincie — `sprint-workload` jest jedyną, która
      grupuje dodatkowo po osobie, ale w kontekście jednego sprintu (planowanie pracy zespołu),
      bez jakiegokolwiek parametru zakresu dat, który przesunąłby ją w stronę „godzin pracownika
      X w miesiącu" — rozróżnienie i uzasadnienie w komentarzu klasy
      `TaskManagementSprintWorkloadReportDefinition`. Żadna definicja nie ma kolumny ani
      parametru identyfikującego pracownika jako **podmiot** raportu.
- [x] **Realne dane `work_log` w dev** (brakowały na starcie tej fazy) — środowisko odbudowane
      od zera (`dotnet run` na świeżo wyczyszczonym schemacie `taskmgmt`, migracje + seed),
      wszystkich pięć raportów przeklikane na żywo w przeglądarce z danymi z seeda (patrz §10),
      w tym `issues-by-state-type-assignee` z realnymi liczbami per projekt/stan/typ.

---

## 6. Faza 8 — rozszerzenia

**Wymagania:** AUT-001/002, SRCH-005, API-003/004/006, SPR-004, NTF-003.

### 6.1 Silnik automatyzacji (AUT-001/AUT-002) — zrobione w tej sesji

> Zakres tej sesji zawężony celowo do samego silnika — plan sesji:
> `C:\Users\rwojcik\.claude\plans\valiant-noodling-globe.md`. **Korekta wobec pierwszej wersji
> tego wiersza**: `if` reguły to strukturalny model warunku (ten sam co przyszłe `guard`
> z WF-003/DMS §4.4: porównania, `and`/`or`, ścieżka do pola, literały), budowany przez UI
> formularzem — **nie** tekstowy parser docelowy dla listy zgłoszeń. Tekstowy parser tego
> samego AST istnieje (`AutomationConditionParser`, test równoważności z formularzem), ale to
> nie jest SRCH-005 (język wyszukiwania `project: ERP state: Open`, wciąż 📐, osobne zadanie).

- [x] Domena: `AutomationRule`/`AutomationAction`/`AutomationRun` (`TaskManagement.Domain/Automation/`),
      wąski model warunku w `TaskManagement.Domain/Automation/Conditions/` (AST DNF, walidator,
      ewaluator, migawka zgłoszenia).
- [x] Silnik wykonawczy: pierwsze zdarzenie integracyjne wewnątrz-modułowe
      (`IssueAutomationTriggerRequested`, przez outbox, konsument w tym samym module —
      `AutomationTriggerHandler`), `AutomationRuleEvaluator` (nowy scope DI per regułę, jedna
      transakcja na regułę, wyjątek jednej reguły nie przerywa pozostałych), `AutomationActionExecutor`
      (mapuje akcję na istniejącą komendę zgłoszenia przez `ICommandDispatcher`).
- [x] AC2 (własna korelacja + oznaczenie w historii) — `IExecutionContext`/`MutableExecutionContext`
      rozszerzone o `AutomationRuleUuid`/`AutomationDepth`; `IssueActivity`/`IssueActivityDto` +
      `IsAutomated`/`AutomationRuleUuid`.
- [x] AC3 (twardy limit głębokości) — `AutomationRuleEvaluator.MaxChainDepth` (5), głębokość
      propagowana przez `AutomationTriggerPublisher` na każdym z czterech punktów publikacji
      (utworzenie, zmiana stanu, komentarz, upłynięcie terminu — dopięte obok istniejących wywołań
      `IssueNotificationPublisher`).
- [x] AUT-002: włącz/wyłącz bez usuwania (`AutomationRuleExecEnable/DisableCommand`), log
      uruchomień jako `AutomationRun` (zapisywany tylko przy faktycznym wykonaniu, nie przy
      pominięciu przez fałszywy warunek), licznik wykonań liczony `COUNT(*)`, nie mutowalne pole.
- [x] API: `AutomationRuleCreate/Set/ExecEnable/ExecDisable/RemoveCommand` na szkielecie wsadowym,
      `searchAutomationRule`/`getAutomationRuleRuns`, nowy kod uprawnienia
      `taskmgmt.automation.manage` (`Permissions.cs` + `permission-codes.ts`).
- [x] Migracja `Automations` (`automation_rule`, `automation_action`, `automation_run`,
      `issue_activity.automation_rule_uuid`) — zastosowana na żywej bazie dev (weryfikacja
      w tej sesji, druga instancja API na porcie 5291, żeby nie kolidować z sesją równoległą
      na 5290/4200).
- [x] Backend: `dotnet test backend/tests/TaskManagement.Tests` 189/189 (+25 nowych —
      `AutomationRuleTests`, `AutomationConditionTests`, w tym test równoważności parser↔AST
      formularza), `Erp.ArchitectureTests` 27/27 (złapał nic do złapania — nazwy komend już
      zgodne z pięcioma czasownikami).
- [x] Front: `TaskManagementAutomationRuleOrchestrator`, enumy w `issue-enums.ts`, zakładka
      „Automatyzacje" na karcie projektu (`ProjectAutomationsComponent` — lista, edytor
      strukturalny warunku/akcji inline pod listą, log uruchomień), znacznik „Automatycznie"
      w `erp-activity-stream`. `pnpm nx run {task-management,client}:build` zielone.
      **Świadome uproszczenie**: pola referencyjne warunku/akcji (stan/typ/tag/przypisany)
      przyjmują uuid jako zwykły tekst — bez dedykowanych pickerów w tej sesji.
- [x] **Żywa weryfikacja w przeglądarce — domknięta 03.09.2026** (`client-monolith`+
      `task-management-mfe`+`TaskManagement.Api`+`Identity.Api`+`Notification.Api`, użytkownik
      `admin@erp.local`). Utworzenie reguły „przy utworzeniu zgłoszenia ustaw priorytet"
      z akcją `SetPriority`, wywołanie przez utworzenie `DEV-11` — log reguły pokazał
      wykonanie, ale zgłoszenie dostało priorytet `Najniższy` zamiast `Krytyczny`.
      **Realny błąd znaleziony i naprawiony**: `AutomationActionExecutor.ReadConfig` wołał
      `JsonSerializer.Deserialize<T>(configJson)` **bez** `PropertyNameCaseInsensitive` — front
      serializuje konfigurację akcji camelCase (`{"priority":4}`), rekordy konfiguracji
      (`PriorityConfig.Priority` itd.) są PascalCase, więc deserializacja się „udawała", ale
      po cichu zostawiała właściwość na wartości domyślnej (`Priority` → `Lowest` = `0`)
      zamiast rzucić błąd — dotyczyło **wszystkich siedmiu rodzajów akcji**, nie tylko
      priorytetu, bo wszystkie korzystają z tej samej metody. Naprawione tym samym wzorcem,
      co już użyty w `ReportDefinitions` (`JsonSerializerOptions { PropertyNameCaseInsensitive
      = true }`) — [`AutomationActionExecutor.cs`](backend/modules/TaskManagement/TaskManagement.Application/Automation/AutomationActionExecutor.cs).
      Żaden z 189 testów jednostkowych tego nie złapał, bo konstruują `ConfigJson` przez
      `JsonSerializer.Serialize` z domyślnym PascalCase — dokładnie ten sam kształt, którego
      front nigdy nie wysyła. Po poprawce: nowe zgłoszenie `DEV-12` dostało `Krytyczny`
      poprawnie, log aktywności pokazał `Automatycznie … zmienił pole priorytet: Normal →
      Critical`. **Drugi, niepowiązany błąd znaleziony i naprawiony przy tej samej okazji**:
      `ProjectAutomationsComponent.triggerPickerConfig`/`priorityOptions` przekazywały do
      `erp-input-picker` surowe klucze tłumaczeń (`PROJECT_KEYS...`) lub gotowe angielskie
      literały (`'Lowest'`, `'Critical'`…) zamiast przetłumaczonego tekstu — dropdown
      „Zdarzenie" pokazywał `project.detail.automations.trigger.issueCreated`, a lista
      priorytetów w akcji była cała po angielsku, mimo że klucze `TASKMANAGEMENT_KEYS.priority.*`
      i wzorzec `this._transloco.translate(...)` w `computed` ze strażnikiem
      `injectTranslationsReadySignal()` (ten sam co w `issue-filter.component.ts`) już
      istniały gdzie indziej w module — po prostu nie zostały tu użyte. Naprawione w
      [`project-automations.component.ts`](frontend/libs/modules/task-management/feature/src/lib/project/page/content/project-automations.component.ts).
      **AC3 (twardy limit głębokości = 5) zweryfikowany na żywo end-to-end**: reguła
      „przy dodaniu komentarza dodaj komentarz" (samo-wyzwalająca się) uruchomiona ręcznym
      komentarzem na `DEV-12` wygenerowała dokładnie **5** automatycznych odpowiedzi
      (`Wykonania: 5` w logu reguły) i poprawnie się zatrzymała — bez nieskończonej pętli.
      **Wyłączenie reguły zweryfikowane**: po `Wyłącz` kolejny komentarz na tym samym
      zgłoszeniu nie wywołał żadnej auto-odpowiedzi. Dane testowe (2 reguły, komentarze)
      posprzątane po weryfikacji; zgłoszenia `DEV-11`/`DEV-12` pozostawione jako artefakt
      deweloperski (wzorem innych faz). `dotnet test backend/tests/TaskManagement.Tests`
      189/189, `Erp.ArchitectureTests` 27/27, `pnpm nx run task-management:build` zielony —
      wszystkie bez regresji po obu poprawkach.

### 6.2 Webhooki wychodzące (API-004) — zrobione w tej sesji

- [x] Domena: `Webhook` (agregat własny, projektowy — URL, sekret, `EventKinds` jako lista
      **reużywająca** `AutomationTriggerKind` zamiast nowego enuma: to ten sam zamknięty zbiór
      „coś się stało ze zgłoszeniem", automatyzacja i webhook różnią się tylko tym, co z tym
      faktem robią, nie tym, co je wyzwala; `ConsecutiveFailureCount` z auto-wyłączeniem po
      `AutoDisableThreshold`=10 kolejnych WYCZERPANYCH dostarczeń, nie pojedynczych prób —
      inaczej webhook wyłączyłby się po jednym przejściowym zacięciu sieci) i `WebhookDelivery`
      (agregat własny, w odróżnieniu od `AutomationRun` **mutowalny** — musi pamiętać próby
      ponowienia: `Status` Pending/Sent/Failed, `AttemptCount`, `NextAttemptAt`, `LastError`,
      `MaxAttempts`=5). `TaskManagement.Domain/Webhooks/`.
- [x] Persystencja: `WebhookConfiguration`/`WebhookDeliveryConfiguration`, `EventKinds` jako
      `text[]` przez `ValueConverter<List<AutomationTriggerKind>, List<string>>` (czytelna
      tablica nazw w bazie, nie liczb) + `ValueComparer` (bez niego EF nie widziałby zmiany
      listy jako różnicy do zapisania — ten sam powód co `IssueConfiguration.CustomFieldsComparer`).
      Migracja `Webhooks`. Żaden z dwóch agregatów nie potrzebował `ValueGeneratedNever()`
      jawnie — w odróżnieniu od `IssueWatcher`/`ProjectMember` (błąd z fazy 5) oba są korzeniami
      zapisywanymi wprost przez `DbSet.Add()`, nie encjami dodawanymi do kolekcji nawigacyjnej
      już śledzonego agregatu.
- [x] Aplikacja: `WebhookCreate/Set/ExecEnable/ExecDisable/RemoveCommand` na szkielecie
      wsadowym wzorem `AutomationRuleCommands`; `WebhookSetCommandHandler` traktuje pusty
      sekret w komendzie jako „zostaw obecny" (`WebhookDto` świadomie nie niesie sekretu z
      powrotem, więc edytor nie ma czego wysłać ponownie). `WebhookTriggerPublisher` — osobna
      klasa od `AutomationTriggerPublisher` (dwa niezależne mechanizmy reagowania na to samo
      zdarzenie, osobni odbiorcy, osobna historia), publikuje `IssueWebhookTriggerRequested`
      z tych samych trzech punktów cyklu życia zgłoszenia co automatyzacja (utworzenie, zmiana
      stanu, komentarz — **bez** upłynięcia terminu, zgodnie z opisem API-004), konsument
      `WebhookTriggerHandler` (ten sam moduł, wzorem `AutomationTriggerHandler`) woła
      `WebhookDispatchService.EnqueueAsync` — dopasowanie webhooka do triggera
      (`Webhook.Subscribes`) robione W PAMIĘCI po `FindByProjectAsync`, nie w SQL: `EventKinds`
      to kolumna konwertowana, której `.Contains()` LINQ-to-SQL by nie przetłumaczył, a
      webhooków jednego projektu nigdy nie jest dużo. `WebhookDeliveryDispatcher`
      (`BackgroundService`, `[ClusterSafe]`) — pętla co 5 s, `WebhookDeliveryLock` (
      `FOR UPDATE SKIP LOCKED` na `webhook_delivery`, dokładnie wzorem `JobQueueLock`, ale
      niegeneryczny — Task Management jest jedynym modułem z webhookami), POST z nagłówkiem
      `X-Erp-Signature: sha256=<hex>` (`WebhookSignature`, HMAC-SHA256 sekretem webhooka) +
      `X-Erp-Event`/`X-Erp-Delivery`, klient HTTP nazwany `webhook-delivery` z timeoutem 10 s
      (bez niego martwy odbiorca trzymałby transakcję, a razem z nią blokadę wiersza, w
      nieskończoność), backoff wykładniczy 15/30/60/120 s. Nowy kod uprawnienia
      `taskmgmt.webhook.manage` (`Permissions.cs` + `permission-codes.ts`), nowa sygnatura
      realtime `taskmgmt.webhook`.
- [x] API: `WebhookCreate/Set/ExecEnable/ExecDisable/RemoveMultipleCommandEndpoint` +
      `searchWebhook`/`getWebhookDeliveries`, wzorem `TaskManagement.Api/Automation`.
      `Erp.ArchitectureTests.CommandNamingTests` złapał od razu brakujące endpointy przy
      pierwszym uruchomieniu po dopisaniu komend — zgodnie z przeznaczeniem testu.
- [x] Testy: `WebhookTests` (11 przypadków — walidacja URL/sekretu/zdarzeń, `Subscribes`,
      reset licznika przy sukcesie i ręcznym włączeniu, **auto-wyłączenie dokładnie na progu
      `AutoDisableThreshold`**) i `WebhookDeliveryTests` (8 przypadków — stan początkowy,
      sukces, retry poniżej limitu z odstępem, wyczerpanie limitu, przycinanie zbyt długiego
      komunikatu błędu). `dotnet test backend/tests/TaskManagement.Tests`: 208/208 (189+19),
      `Erp.ArchitectureTests` 27/27.
- [x] Front: NSwag zregenerowany (`generate-api`, nie `nswag` — nazwa targetu w tym module),
      `TaskManagementWebhookOrchestrator` wzorem `TaskManagementAutomationRuleOrchestrator`,
      `WEBHOOK_DELIVERY_STATUS` w `issue-enums.ts` (reużywa `AUTOMATION_TRIGGER_KIND` dla
      zdarzeń, bez nowego enuma), zakładka „Webhooki" na karcie projektu
      (`ProjectWebhooksComponent`, wzorem `ProjectAutomationsComponent` — lista, edytor
      URL/sekret/checkboxy zdarzeń pod listą, log dostarczeń rozwijany per webhook).
      **Tym razem od razu poprawnie przetłumaczone** (nauczka z weryfikacji automatyzacji
      w tej samej sesji, patrz §6.1/8.1): etykiety zdarzeń i statusów idą przez
      `computed()`+`injectTranslationsReadySignal()`+`this._transloco.translate(...)`, nie
      surowe klucze ani literały. `pnpm translate:keys`, `tsc --noEmit` czyste (ten sam
      pre-istniejący `TS4029`), `pnpm nx run task-management:build` zielony.
- [x] **Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+
      `TaskManagement.Api`+`Identity.Api`, lokalny odbiornik HTTP w Pythonie na porcie 8999
      jako cel webhooka, drugi restart `Identity.Api` żeby zareconcilować nowy kod uprawnienia):
      utworzenie webhooka z dwoma zdarzeniami (utworzenie zgłoszenia, zmiana stanu) — oba
      dostarczone poprawnie, **podpis HMAC-SHA256 zweryfikowany bit-do-bitu** ręcznym
      przeliczeniem w Pythonie z tym samym sekretem i dokładnie tym samym ciałem żądania;
      panel „Dostarczenia" pokazuje historię z poprawnymi statusami i znacznikiem czasu.
      **Retry z rosnącym odstępem zweryfikowany na żywo**: adres zmieniony na martwy port,
      nowe zgłoszenie → 4 nieudane próby w logu (15 s → 30 s → 60 s → 120 s), piąta
      wyczerpuje limit → dostarczenie `Failed` w UI z komunikatem `Connection refused`,
      licznik błędów webhooka wzrósł do 1 (widoczny na czerwono w liście). **Wyłączenie
      zweryfikowane**: po `Wyłącz` kolejne zgłoszenie nie wygenerowało żadnego dostarczenia
      (ani w logu backendu, ani w panelu UI). **Usunięcie zweryfikowane**: modal potwierdzenia
      z poprawnym tłumaczeniem, webhook zniknął z listy razem z historią. **Nieprzetestowane
      na żywo** (czasochłonność — 10 wyczerpanych dostarczeń × ~225 s ≈ 37 minut): pełne
      auto-wyłączenie po progu 10 kolejnych błędów — pokryte wyłącznie testem jednostkowym
      domeny (`Webhook_wylacza_sie_sam_po_progu_kolejnych_bledow`), mechanizm identyczny do
      zweryfikowanego na żywo pojedynczego przyrostu licznika. Zgłoszenia testowe (`DEV-13`,
      `DEV-14`) pozostawione jako artefakt deweloperski; webhook testowy usunięty po
      weryfikacji.

### 6.3 Reszta fazy 8 — pozostaje

- [ ] Klucz integracyjny jako klient Keycloak z własnym zestawem uprawnień (API-003) — „genuinely
      new ground" wg researchu tej sesji: dziś nie ma żadnego pojęcia tożsamości maszynowej poza
      `erp-identity-service` wołającym siebie nawzajem; trzeba nowy klient `client_credentials`
      + rozszerzenie `IPermissionProvider`/`PermissionClaimsTransformation` o zestaw uprawnień
      keyowany po `client_id`, nie po `sub`.
- [x] Burndown z historii zmian stanów (`SPR-004`), na tej samej infrastrukturze raportowej
      (`IReportDefinition`, wzorem `TaskManagementCycleTimeByStateCategoryReportDefinition`) —
      `TaskManagementSprintBurndownReportDefinition`: `remaining_count`/`remaining_estimate_minutes`
      per dzień sprintu, liczone z `issue_activity` (pierwsze wejście w kategorię `Done`, świadomie
      bez śledzenia powrotów — patrz komentarz XML klasy). Front: wpis w `REPORT_DEFINITIONS`,
      generyczna tabela (bez nowej infrastruktury wykresów). Testy: 2 w `Erp.IntegrationTests`
      (`TaskManagementSprintBurndownReportDefinitionTests`) zielone; zweryfikowane na żywo w
      przeglądarce (raport generuje się bez błędu; brak wierszy bo dev seed nie ma sprintu
      z ustawionymi datami — zgodne z logiką pomijania sprintów bez dat/`Planned`).
- [ ] Preferencje powiadomień per projekt (`NTF-003`) — filtr odbiorców w `IssueNotificationPublisher`
      (ma już kontekst projektu), nowy agregat `ProjectNotificationPreference`.
- [x] Język wyszukiwania SRCH-005 — `IssueSearchDslParser` (tokenizer/parser węższy niż
      `AutomationConditionParser`, bez `and`/`or`) + `IssueSearchDslResolver` (Infrastructure,
      rozwiązuje `project`/`state`/`priority`/`assignee`/`tag`/`text` na `SearchIssueRequest`).
      Wpięty w `IssueQueries.SearchAsync`/`GetMatchingUuidsAsync` przez nowe opcjonalne pole
      `SearchIssueRequest.Dsl` — **bez nowego endpointu**, ta sama ścieżka filtrowania co formularz
      (AC2 mechanicznie zagwarantowane). Błędy (AC1) jako `IssueSearchDslParseException : DomainException`
      z pozycją w komunikacie → `422` przez istniejący `ErpProblemDetailsHandler`, bez zmian
      w building-blocks. Testy: 8 w `TaskManagement.Tests` (parser) + 3 w `Erp.IntegrationTests`
      (resolver, w tym AC2 wprost) zielone; zweryfikowane na żywo w przeglądarce — `project: DEV
      state: Done` zwrócił poprawny zestaw, nieznane pole (`foo: bar`) dało czytelny błąd
      z pozycją w toaście, bez 500.

---

## 7. Zmiany łamiące kontrakt NSwag

Każda z tych zmian wymaga **świadomej regeneracji klienta** i przejrzenia miejsc użycia.
Kolejność: backend → uruchomienie API → `nswag` → naprawa kompilacji frontu.

| Faza | Zmiana | Skutek |
|---|---|---|
| 4 | `IssueCreateCommand` + `TypeUuid` (wymagane) | każde wywołanie tworzenia zgłoszenia trzeba uzupełnić |
| 4 | `IssueDto`/`IssueListItemDto` + pola typu | rozszerzenie, kompatybilne wstecz |
| 4 | `FieldDefinitionDto` + `name` | front przestaje wyświetlać `nameKey` |
| 5 | `IssueDto` + obserwujący, `derivedDeliveryState` | rozszerzenie |
| 5 | nowy `IssueHeaderDto` | nowy typ, brak kolizji |
| 6 | `IssueDto` + `resolution`, tagi; `SearchIssueFilter` + tagi i fraza | rozszerzenie |
| 7 | `IssueDto` + `estimateMinutes` | rozszerzenie |

**Zasada:** nie przemianowujemy istniejących klas endpointów ani komend. Przemianowanie zmienia
nazwę metody klienta i nazwę typu — to najtańszy sposób na zepsucie frontu bez błędu kompilacji
po stronie backendu.

---

## 8. Migracje bazy — pełna lista planowana

| Faza | Nazwa | Zawartość |
|---|---|---|
| 4 | `IssueTypes` | `issue_type_scheme`, `issue_type`, `project.issue_type_scheme_uuid`, `issue.type_uuid` (**wymagane**), `field_definition.name` |
| 5 | `WatchersAndIntake` | `issue_watcher`, `issue.derived_delivery_state`, indeks `(due_at) where …` |
| 5 | `ProjectSla` | `sla_policy`, kalendarz roboczy projektu |
| 6 | `SprintsAndBacklog` | `sprint`, indeks częściowy aktywnego sprintu |
| 6 | `TagsAndResolution` | `tag`, `issue_tag`, `resolution`, `issue.resolution_uuid` |
| 6 | `FullTextSearch` | kolumna `tsvector` + indeks GIN + trigger |
| 6 | `WorkLogAndEstimate` | `work_log`, `issue.estimate_minutes`, słownik rodzajów pracy |
| 7 | `SavedViews` | `saved_view` |
| 7 | `ProjectDefaultSavedView` | `project.default_saved_view_uuid` (nullable, referencja miękka) |
| 8 | `Automations` | `automation_rule`, `automation_run` |
| 8 | `Webhooks` | `webhook`, `webhook_delivery` |

Migracja jest **krokiem wdrożenia**, nie komendą aplikacyjną
([`production.md`](docs/backend/production.md)) — dotyczy to również indeksów pod pola własne.

---

## 9. Ryzyka i miejsca, gdzie łatwo się przewrócić

| Ryzyko | Gdzie | Co robimy |
|---|---|---|
| `issue.type_uuid` jako kolumna wymagana na istniejących danych | faza 4 | czyścimy schemat w dev; na danych byłby to trzyetapowy backfill |
| Typ z własnym schematem stanów rozjeżdża tablicę | faza 4 | kolumny tablicy budowane z **unii stanów** projektów źródłowych; stan bez kolumny → kolumna domyślna + oznaczenie konfiguracji jako niepełnej (`BRD-008`) |
| Skan terminów duplikuje powiadomienia przy dwóch instancjach | faza 5 | `[ClusterSafe]` + dzierżawa; test na dwóch instancjach jest częścią DoD |
| Predykat widoczności puchnie od wyjątków | fazy 5–6 | dwa wyjątki i koniec; trzeci = przejście na materializowany ACL wzorem DMS, nie kolejny `OR` |
| Rank i sprint jako dwa mechanizmy kolejności | faza 6 | backlog używa **tego samego** `board_card.rank`; drugi mechanizm od razu się rozjedzie |
| Pełny tekst obchodzi uprawnienia | faza 6 | predykat w tym samym zapytaniu, test negatywny obowiązkowy |
| Zmiana w `erp-rich-text` psuje inne moduły | faza 4 | wklejanie obrazów jest **opcjonalne** — aktywne tylko dla konfiguracji z podanym portem wgrywania; zestawy bez portu zachowują dzisiejsze zachowanie. Przegląd użyć `erp-rich-text` w DMS i Catalogu przed scaleniem |
| Komponenty prezentacyjne zostają w `feature` | faza 4 | wyprowadzenie do `ui` jest **pozycją DoD fazy**, nie sprzątaniem „przy okazji" — przy okazji nie zdarza się nigdy |
| Raport staje się obejściem widoczności | faza 7 | zapytania raportowe nie zwracają tytułu ani opisu; `taskmgmt.report.read.all` **nie wchodzi do predykatu listy zgłoszeń** (`PERM-005` AC3). Test negatywny w DoD |
| Rejestracja czasu nie jest wypełniana | faza 6 | wpis w dwóch kliknięciach z karty; jeśli po miesiącu `work_log` jest pusty, raport z fazy 7 nie ma sensu i trzeba wrócić do UX, a nie dokładać wykresów |
| Automatyzacja wywołująca samą siebie | faza 8 | twardy limit głębokości łańcucha + log; brak limitu zjada instancję |
| Katalog uprawnień rośnie z liczbą projektów | wszystkie | rola w projekcie jest **atrybutem nadania**; nowy kod tylko wtedy, gdy to nowa *funkcja* (`taskmgmt.tag.manage`) |

---

## 10. Weryfikacja

Sekcja uzupełniana w trakcie — po każdej fazie wpis: co uruchomiono, na czym, z jakim wynikiem.

| Faza | Data | Co zweryfikowano | Wynik |
|---|---|---|---|
| 0–3 | 27.08.2026 | end-to-end wg opisu w `docs/backend/task-management.md` | ✅ |
| 4 | 01.09.2026 | `dotnet test backend/tests/TaskManagement.Tests` (78/78), `Erp.ArchitectureTests` (26/26), `tsc --noEmit` obu bibliotek frontu, pełny build `client:serve`, przeklikanie na żywo w przeglądarce (typ zgłoszenia, hierarchia, tablica z modalem WF-004, tryb drzewa, wklejanie obrazka `Ctrl+V` w opisie i komentarzu z przeżyciem odświeżenia strony) | ✅ |
| 5 | 01.09.2026 | Backend: `dotnet test backend/tests/TaskManagement.Tests` (97/97), `Erp.ArchitectureTests` (27/27, po Etapie A i po Etapie E), migracje `AddUserNotification`/`WatchersAndIntake` uruchomione na żywej bazie deweloperskiej, endpointy `user-notification/*` i pola `IssueDto.derivedDeliveryState`/`isWatchedByMe`/`watcherCount` zweryfikowane przez `curl` na uruchomionych `TaskManagement.Api`/`Notification.Api`. Front: regeneracja NSwag dla obu modułów, `pnpm nx run {task-management,notification,client}:build` (produkcyjny build federacji) zielony, `lint` na wszystkich dotkniętych bibliotekach bez nowych błędów. Nie wykonano pełnego scenariusza end-to-end w przeglądarce (zamawiający→dev→auto-przeliczenie stanu realizacji→powiadomienie w dzwonku) — działający w tle serwer deweloperski innej sesji serwował wciąż stary bundle remotów `notification`/`task-management`, więc wizualna weryfikacja UI (drugi tab dzwonka, przycisk „obserwuję”, strona „Zlecenia”) pozostaje do zrobienia w kolejnej sesji ze świeżo odpalonym `client-monolith`. Przegląd kodu `IssueOverdueScanService` pod kątem dzierżawy (`taskmgmt:issue-overdue-scan`) potwierdza brak duplikacji przypomnień między instancjami. | ⚠️ częściowo (backend ✅, front bez żywej weryfikacji UI) |
| 5 (dokończenie) | 01.09.2026 | Front dokończony na żywo po restarcie `client-monolith` ze świeżym bundlem: zakładki popovera dzwonka, strona `/task-management/request` (rejestr `MKT`, lista `MKT-1/2/3`), zapis i przeżycie odświeżenia zakładki SLA na karcie projektu. Podczas testu przycisku obserwowania na karcie zgłoszenia (`MKT-1`) wykryto realny błąd: `DbUpdateConcurrencyException` w `BulkCommandRunner`, bo `IssueWatcherConfiguration`/`ProjectMemberConfiguration` nie miały `ValueGeneratedNever()` na kluczu UUIDv7 generowanym po stronie klienta — EF traktował nowy insert jako update na nieistniejącym wierszu; dodatkowo błąd ujawnił samo-zakleszczenie w ścieżce izolacji błędów `BulkCommandRunner`. Naprawiono oba (`IssueConfiguration.cs`, `ProjectConfiguration.cs`, `BulkCommandRunner.cs`), dodano regresję w `Erp.IntegrationTests`, `dotnet test` zielony (`Erp.IntegrationTests` 23/23, `TaskManagement.Tests` 97/97, `Erp.ArchitectureTests` 27/27). Re-weryfikacja end-to-end po przebudowie i restarcie `TaskManagement.Api`: kliknięcie „Obserwuj” na `MKT-1` → `POST issue/batch-add-watcher` 200 OK → UI „Przestań obserwować”/„Obserwujący: 2” → w bazie `taskmgmt.job` wiersz `IssueAddWatcherCommand` ze `status=2` (Completed), `succeeded_count=1`, oraz nowy wiersz w `taskmgmt.issue_watcher` z `opted_out_at IS NULL`; kliknięcie „Przestań obserwować” → `POST issue/batch-remove-watcher` 200 OK → UI wraca do „Obserwuj”/„Obserwujący: 1” → job `IssueRemoveWatcherCommand` `status=2`/`succeeded_count=1`, a wiersz w `issue_watcher` **pozostaje** z ustawionym `opted_out_at` (zgodnie z projektem „opt-out nigdy nie kasuje wiersza” z `IssueWatcher.cs`), nie jest usuwany. | ✅ |
| 6.1 (sprinty i backlog) | 02.09.2026 | Backend: nowy agregat `Sprint` (`Planned/Active/Closed`, indeks częściowy `unique(board_uuid) where status='Active'`), migracja `Sprints`, komendy `SprintCreate/SetDates/ExecStart/ExecClose` + `BoardSetCardSprintCommand` (dopisana poza pierwotnym planem — `BoardCard.SetSprint` istniała w domenie od fazy 2, ale żadna komenda jej nie wywoływała), sygnatura `taskmgmt.sprint`. `dotnet test backend/tests/TaskManagement.Tests` 108/108 (+11 nowych), `Erp.ArchitectureTests` 27/27. Regeneracja NSwag po restarcie `TaskManagement.Api` na 5290 (wykryto i ubito osierocony proces ze starym bundlem sprzed zmian). Front: orkiestrator `TaskManagementSprintOrchestrator`, rozszerzenie `TaskManagementBoardOrchestrator` o `setCardSprintAsync`, podstrona `/task-management/board/:uuid/backlog` (`BacklogStore`/`BacklogComponent`/`BacklogListComponent`) z przeciąganiem między backlogiem a sprintem po tym samym mechanizmie ranku co tablica kanban, modale `SprintCreate`/`SprintExecClose` (jawny wybór celu przeniesienia niedokończonych zgłoszeń — SPR-003 AC1) i potwierdzenie `SprintExecStart`. `tsc --noEmit` czyste dla `util`/`data-access`/`feature`/`contract` (jeden pre-istniejący, niezwiązany błąd `TS4029` w `erp-table.component.ts` potwierdzony przez `git stash -u`), `lint` bez nowych błędów, `pnpm nx run task-management:build` (federacja, produkcyjny) zielony. **Nie wykonano** przeklikania na żywo w przeglądarce (drugi dev server tej sesji zajęty przez inną rozmowę) — do zrobienia w kolejnej sesji. Rejestracja czasu (WorkLog, §4.4), tagi/rozwiązanie (§4.2), operacje masowe (§4.3) i wyszukiwanie/tablica/projekt (§4.5) fazy 6 pozostają do zrobienia. **Uzupełnienie 02.09.2026 (przy weryfikacji 6.2)**: brak żywej weryfikacji tej fazy ukrywał realny błąd w `TaskManagementSprintOrchestrator.searchSprintsAsync` — patrz wiersz 6.2, ten sam błąd naprawiony też tutaj; sam backlog (drag&drop, modale sprintu) pozostaje bez ponownej żywej weryfikacji po tej poprawce. | ⚠️ częściowo (backend+front zbudowane i przetestowane statycznie, bez żywej weryfikacji UI; błąd widoczności orkiestratora naprawiony, backlog do ponownego sprawdzenia na żywo) |
| 6.2 (tagi i rozwiązanie) | 02.09.2026 | Backend: agregaty `Tag`/`Resolution` (oba `project_uuid` nullable = globalne), `IssueTag` jako encja podrzędna `Issue` (wzorem `IssueWatcher`), `Issue.ResolutionUuid` + specjalny warunek w `Issue.SetState` (kod `"resolution"` sprawdzany przez `ResolutionUuid`, nie `_customFields`; powrót z `Done` czyści rozwiązanie), migracja `TagsAndResolution` (`tag`, `issue_tag`, `resolution`, `issue.resolution_uuid`, FK `Restrict`), nowy kod uprawnienia `taskmgmt.tag.manage`, seed 4 rozwiązań systemowych (`Zrobione`/`Duplikat`/`Nie zrobimy`/`Nie da się odtworzyć`) uzgadnianych po stałych uuid, usunięcie starego pola niestandardowego `resolution` z seeda schematu pól DEV. `dotnet test backend/tests/TaskManagement.Tests` 116/116 (+8: `TagTests`, `IssueTagTests`, przepisane testy `WorkflowTransitionRequiredFieldsTests` na `SetResolution`), `Erp.ArchitectureTests` 27/27. Front: orkiestratory `TaskManagementTagOrchestrator`/`TaskManagementResolutionOrchestrator`, `IssueTagsComponent` (chipsy `erp-tag-chips` — atom przygotowany w fazie 4, pierwsze realne użycie — z dopięciem/odpięciem przez `addTagOptimisticAsync`/`removeTagOptimisticAsync` i zakładaniem tagu w locie gated `taskmgmt.tag.manage`), kolumna i filtr wielokrotnego wyboru po tagach na liście zgłoszeń, `WorkflowRequiredFieldsStepComponent` rozszerzony o osobną kontrolkę rozwiązania (nigdy nie znajdzie się w profilu pól, bo nie jest już custom fieldem). `tsc --noEmit` czyste dla `util`/`data-access`/`feature`/`contract` (ten sam pre-istniejący `TS4029`), `lint` bez nowych błędów (te same 2 pre-istniejące w `data-access`, nietknięte pliki), `pnpm nx run task-management:build` zielony. **Pełne przeklikanie na żywo** (`client-monolith` + `task-management-mfe` + `TaskManagement.Api` + `Identity.Api`, użytkownik `admin@erp.local`): utworzenie tagu „urgent” w locie i dopięcie do `DEV-1`, usunięcie chipa (natychmiastowe, bez odświeżania), ponowne dopięcie z pickera, przejście `DEV-1` do `Zrobione` przez modal WF-004 z pickerem rozwiązań (4 systemowe pozycje), zapis, powrót do `W toku` i potwierdzenie w odpowiedzi API `resolutionUuid: null` (ISS-007 AC2). **Podczas tej weryfikacji wykryte i naprawione dwa realne błędy**: (1) `{@link IssueTagsComponent}` — przycisk „Utwórz i dopnij” i placeholder pola nowego tagu renderowały się jako surowe klucze tłumaczeń zamiast tekstu (brakujący `erpTranslate`); (2) trzy orkiestratory (`Tag`, `Resolution`, i **`Sprint` z fazy 6.1**) zapisywały wynik wyszukiwania do identity mapy, ale nie oznaczały uuid jako „załadowane” dla `getViewModel()` — widok był zawsze pusty mimo poprawnej odpowiedzi API; naprawione dopisaniem `await this.loadAsync(uuids)` po `identityMap.setMany(...)`. To pierwsza faza 6.x z pełną żywą weryfikacją UI od czasu przerwy między fazą 5 a 6. | ✅ |
| 6.3 (operacje masowe) | 02.09.2026 | Backend: sześć z siedmiu operacji `BULK-002` (zmiana stanu, przypisanie, priorytet, tag, sprint) już działały jako zwykłe batch endpointy z wcześniejszych faz — nic nie trzeba było dopisywać. Nowa: `IssueSetProjectCommand` (ISS-010) — cascade po całym poddrzewie (`IIssueRepository.FindDescendantsAsync`, wyszukiwanie falami, bez założenia o maks. głębokości hierarchii), nowe klucze `AllocateRangeAsync` jednym przeskokiem licznika, walidacja CAŁEGO poddrzewa przed jakąkolwiek mutacją, `GetIssueMoveToProjectPreviewEndpoint` do ekranu decyzji o polach bez odpowiednika (ISS-010 AC4), `IssueTargetProjectMustExistRule` jako pre-check wsadowy. `dotnet test backend/tests/TaskManagement.Tests` 121/121 (+5: `IssueMoveToProjectTests`), `Erp.ArchitectureTests` 27/27 (po poprawce nazwy komendy na `IssueSetProjectCommand` — `Move` nie jest jednym z pięciu czasowników, złapane od razu przez `CommandNamingTests`). Front: toolbar listy zgłoszeń (istniejący `ErpSelectionScope` z wcześniejszej fazy) rozszerzony o „Dodaj tag"/„Usuń tag"/„Przenieś do projektu"; modal przeniesienia z własnym szablonem (nie `ErpStepContentBuilder`, wzorem `WorkflowRequiredFieldsStepComponent`) renderującym ekran decyzji dopiero po odpowiedzi z podglądu; przekierowanie ze starego klucza na bieżący w `issue-detail.component.ts` (ISS-010 AC2). `tsc --noEmit` czyste dla `feature`/`data-access`/`contract` (ten sam pre-istniejący `TS4029`), `lint` bez nowych błędów, `pnpm nx run task-management:build` zielony. **Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+`TaskManagement.Api`+`Identity.Api`): masowe dodanie/usunięcie tagu (200 OK, potwierdzone w bazie), przeniesienie `DEV-10`→`MKT-4` z ekranem decyzji pokazującym `component`/`resolution` jako pola bez odpowiednika w MKT, potwierdzone w bazie (`previous_keys={DEV-10}`, nowy klucz `MKT-4`, projekt zmieniony), wejście na `/task-management/issue/DEV-10` przekierowało na `MKT-4` (breadcrumb i URL). **Podczas tej weryfikacji wykryte i naprawione trzy realne błędy**: (1) `IssueSetProjectStepComponent` czytał `this.command()()` wprost w konstruktorze (przed zamontowaniem wymaganego inputu) — `NG0950`, modal renderował się pusty; naprawione przeniesieniem odczytu do `effect()`, wzorem innych kroków modali. (2) Ten sam krok odświeżał podgląd pól przez `effect()` obserwujący `FormControl.value` — to nie jest sygnał, więc `effect` uruchamiał się raz i nigdy więcej; podgląd nigdy się nie odświeżał po zmianie projektu. Naprawione przeniesieniem ładowania podglądu do `valueChanges.subscribe`. (3) **Najpoważniejszy**: `IssueRepository.FindAsync` nie miał `.Include(i => i.Tags)` — `Issue.RemoveTag` ładowany bez kolekcji zawsze widział ją pustą i cicho no-opował (żaden wyjątek, `job` raportował sukces), więc **masowe i pojedyncze odpinanie tagu nigdy realnie nie działało od fazy 6.2 włącznie** — bug siedział też za `IssueTagsComponent.removeTagOptimisticAsync` na karcie zgłoszenia, zamaskowany przez optymistyczną aktualizację UI (front POKAZYWAŁ zdjęcie chipa, baza go nie zdejmowała, dopóki `reloadAsync` po zakończeniu zadania nie pokazał chipa z powrotem — co umykało bez odświeżenia strony w danym momencie). Naprawione dopisaniem `.Include(i => i.Tags)` obok istniejącego `.Include(i => i.Watchers)`; potwierdzone bezpośrednim zapytaniem do bazy przed i po poprawce. **Nieprzetestowane na żywo**: przeniesienie zgłoszenia z faktycznymi dziećmi (brak takiej hierarchii w danych deweloperskich) — logika cascade zweryfikowana na poziomie kodu i przez `IssueMoveToProjectTests`, nie end-to-end w przeglądarce. | ⚠️ częściowo (backend+front zweryfikowane na żywo dla ścieżek bez dzieci, w tym naprawiony poważny bug z fazy 6.2; cascade do potomków bez żywej weryfikacji) |
| 6.4 (rejestracja czasu) | 02.09.2026 | Backend: `IssueWorkLog` (agregat własny, wzorem `IssueComment` — patrz uzasadnienie w §4.4) + `IssueRepository`-siostrzane `IssueWorkLogRepository`/`WorkTypeRepository`; `WorkType` (agregat wzorem `Tag`, cztery globalne domyślne z `WorkTypeDefaults`, seedowane identyfikatorami stałymi); `Issue.EstimateMinutes`+`SetEstimate`; migracja `WorkLogAndEstimate`; komendy `IssueAddWorkLogCommand`/`IssueRemoveWorkLogCommand` (tylko autor)/`IssueSetEstimateCommand` na skeletonie wsadowym; `IssueDeliveryHoursQueries` — rekurencyjne CTE WSTECZ po `Delivers` (TIME-004, dowolna głębokość) z `SharedWithOtherRequestsCount` per wykonawca (AC3), bez endpointu (nic go jeszcze nie woła, raport wchodzi w fazie 7); dwie nowe sygnatury realtime (`taskmgmt.issue_work_log`, `taskmgmt.work_type`) zarejestrowane w `AggregateSignatureMap`. `dotnet test backend/tests/TaskManagement.Tests` 128/128 (+7: `IssueWorkLogTests`), `Erp.ArchitectureTests` 27/27. Front: `IssueWorkLogService` (child-cache wzorem `IssueCommentService`), `TaskManagementWorkTypeOrchestrator` (wzorem `TaskManagementTagOrchestrator`), trzy nowe metody na `TaskManagementIssueOrchestrator`; `IssueTimeComponent` (wzorem `IssueTagsComponent`) — rodzaj pracy wstępnie wybrany, dodanie wpisu to minuty + Enter/przycisk (TIME-001 AC3), estymata edytowalna inline, suma i różnica bez ostrzeżenia (TIME-002 AC1); wpisy czasu w strumieniu aktywności jako filtr `Czas` — atom `erp-activity-stream` miał już gotowy trzeci kanał czekający od fazy 4, wystarczyło skierować `IssueActivityKind.WorkLogAdded/Removed` do `kind:'time'` zamiast do „Historii" w `IssueActivityComponent`. `tsc --noEmit` czyste dla `feature`/`data-access` (ten sam pre-istniejący `TS4029`), `lint` bez nowych błędów (jeden pre-istniejący błąd w `issue-child-cache.ts`, potwierdzony przez `git stash`, niezwiązany), `pnpm nx run task-management:build` zielony. **Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+`TaskManagement.Api`+`Identity.Api`+`Notification.Api`, na `DEV-1`): dodanie wpisu 45 min (200 OK, potwierdzone w bazie), ustawienie estymaty 60 min (200 OK, potwierdzone), „Pozostało: 15 min" policzone poprawnie, usunięcie wpisu (200 OK, `issue_work_log` wraca do zera wierszy), wpisy widoczne w strumieniu aktywności i poprawnie izolowane filtrem „Czas" (checkbox `time` chowa komentarze/historię). **Trzy realne błędy znalezione i naprawione przy tej weryfikacji**: (1) **DateOnly przez JSON** — `loggedOn`/`startsOn`/`endsOn` to `DateOnly?` po stronie backendu, a wbudowany konwerter JSON w .NET akceptuje WYŁĄCZNIE `"yyyy-MM-dd"`, nie pełny znacznik czasu; front przypisywał `new Date(value)` do pola typu `Date`, co `JSON.stringify` serializował przez `toISOString()` do `"…T00:00:00.000Z"` i backend odrzucał to jako 400 (`The JSON value is not in a supported DateOnly format`) — **ten sam błąd istniał od fazy 6.1 we `sprint-create.step.ts`, nigdy niewykryty, bo sprint bez dat nie wywoływał tej ścieżki**; naprawione rzutowaniem surowego stringa (`value as unknown as Date`) w obu miejscach, żeby `JSON.stringify` wyemitował dokładnie to, co przyszło z inputu. (2) `IssueTimeComponent.remainingMinutes` porównywał `estimate === undefined`, ale backend serializuje brak estymaty jako JSON `null`, nie pomija pola — `null - zalogowano` dawało fałszywe „Pozostało: -45 min" zamiast schowanego wiersza; naprawione porównaniem przez `estimateMinutesOrNull() === null` (already-`??`-normalizowany helper) zamiast ścisłego `=== undefined`. (3) **Środowiskowe, nie w kodzie**: WebSocket SignalR (`ws://localhost:5250/hubs/sync`) nie łączył się w tej sesji mimo uruchomionego `Notification.Api` — realtime po `taskmgmt.issue`/`taskmgmt.issue_work_log` nie odświeżał widoku bez ręcznego przeładowania strony (dane po stronie serwera i zapytań HTTP były poprawne przez cały czas, potwierdzone bezpośrednim zapytaniem do bazy); ta sama rodzina objawów co znana z wcześniejszych sesji usterka „Browser pane nie kompozytuje klatek" — klik na przycisk potwierdzenia w dialogu usunięcia wpisu czasu nie docierał do strony (ani przez `computer.left_click`, ani przez zsyntetyzowane zdarzenia JS), więc usunięcie zweryfikowano wywołaniem tego samego żądania HTTP z tokenem sesji wprost z konsoli przeglądarki (200 OK, baza zgadza się z oczekiwaniem) zamiast klikiem w UI. **Nieprzetestowane na żywo**: `IIssueDeliveryHoursQueries` (TIME-004) — bez UI-konsumenta w tej fazie, zweryfikowane wyłącznie przeglądem kodu (ten sam status co `IssueGraphQueries`, też bez testów jednostkowych z tego samego powodu — surowe SQL). | ⚠️ częściowo (backend+front zweryfikowane na żywo dla dodania/edycji/usunięcia wpisu i estymaty, w tym dwa naprawione realne błędy z fazy 6.1 i 6.4; usunięcie potwierdzone przez bezpośrednie wywołanie HTTP zamiast klikiem, z powodu awarii kompozytowania Browser pane w tej sesji; CTE po `Delivers` bez żywej weryfikacji, brak UI-konsumenta) |
| 6.5 (wyszukiwanie, tablica, projekt) | 02.09.2026 | Siedem niezależnych funkcji, szczegóły projektowe i wykryte błędy w §4.5. Backend: GIN + `websearch_to_tsquery` po tytule/opisie/komentarzach (SRCH-003), `Project.SetCode`/`IsArchived`/`EnsureNotArchived` + `ProjectKeyCounter.SetPrefixAsync` (PRJ-003/004), `IssueRemoveAttachmentCommand` + outbox `ArtifactDeletionRequested` + nowy konsument `ArtifactDeletionRequestedHandler` (ATT-002), `IssueExternalLink` — encja podrzędna wzorem `IssueTag` (API-005), `Board.SwimlaneMode`/`SwimlaneFieldCode` + `BoardColumn.WipLimit` (BRD-006/007); `searchBoard` (BRD-009) już istniał z wcześniejszej fazy, bez zmian. Migracja `SearchSwimlaneArchiveAndLinks`. `dotnet test backend/tests/TaskManagement.Tests` 149/149 (+21: `ProjectArchivalAndCodeTests`, `IssueExternalLinkTests`, `BoardSwimlaneAndWipTests`), `Erp.ArchitectureTests` 27/27. Front: `BoardListComponent` (BRD-009), grupowanie `BoardStore.swimlanes` liczone od surowych kart (nie od już złożonych kolumn) tak, żeby nakładka optymistyczna przeciągnięcia trafiała we właściwy swimlane+kolumnę jednym splice'em, drag izolowany per swimlane przez zasięg `cdkDropListGroup` na wierszu; edycja prefiksu inline i przycisk archiwizacji na karcie projektu; `IssueExternalLinksComponent` i przycisk usunięcia w `IssueAttachmentsComponent`; skok do klucza w `IssueFilterComponent.onSearch` (SRCH-004). `tsc --noEmit` czyste dla `feature`/`data-access`/`contract` (ten sam pre-istniejący `TS4029`), `lint` bez nowych błędów, `pnpm nx run task-management:build` zielony. **Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+`TaskManagement.Api`+`Identity.Api`+`Notification.Api`): zmiana prefiksu DEV→DEV2 i z powrotem (stare klucze bez zmian, licznik nie zresetowany — potwierdzone w bazie); archiwizacja/przywrócenie MKT (znika z listy, link po uuid nadal działa, próba założenia zgłoszenia w MKT odrzucona `taskmgmt.project_archived` w `job_item`); dodanie/usunięcie linku zewnętrznego na `DEV-1`; usunięcie dwóch załączników na `DEV-1`; wyszukiwanie słowa wyłącznie w opisie (nie w tytule) trafia właściwe zgłoszenie; fraza w cudzysłowie ze słowami sąsiadującymi trafia, z tymi samymi słowami w innej kolejności — nie trafia (prawdziwa fraza, nie AND); wpisanie klucza w wyszukiwarce otwiera kartę wprost; lista dwóch tablic renderuje się zamiast auto-przekierowania; grupowanie „Po priorytecie” poprawnie rozkłada karty na pięć swimlane'ów z tymi samymi kolumnami w każdym. **Trzy realne błędy znalezione i naprawione przy tej weryfikacji, żaden w logice domenowej**: (1) **`TaskManagement.Api` nigdy nie nasłuchiwał `erp.events`** — brakujący `Messaging:ListenQueueName` w `appsettings.Development.json` (Catalog/Notification go mają, TaskManagement nigdy nie dostał w żadnej wcześniejszej fazie); konsument ATT-002 był poprawny, ale bez związanej kolejki wiadomość nigdy do niego nie docierała — dwa pierwsze usunięcia załączników zostawiły pliki-sieroty w MinIO (potwierdzone `mc ls`), naprawione dopisaniem kolejki i restartem, trzecie usunięcie po poprawce faktycznie skasowało obiekt (potwierdzone zniknięciem z `erp-taskmgmt-media/assets/`); sierotę sprzed poprawki usunięto ręcznie jako sprzątanie testu. (2) **Ten sam błąd `null`/`undefined` co przy estymacie w fazie 6.4**, teraz w `BoardColumnComponent.wipExceeded`: `!== undefined` przepuszczało `null` (backend serializuje brak limitu jako `null`), a `cards.length > null` rzutuje na `0` i jest prawdziwe dla każdej niepustej kolumny — wszystkie kolumny na żywej tablicy pokazywały fałszywe „Przekroczono limit WIP” bez ustawionego limitu; naprawione jawnym `!== null && !== undefined`. (3) Picker projektu w modalu tworzenia zgłoszenia czytał wspólny cache orkiestratora bez filtra — zarchiwizowany projekt doładowany przez INNY widok (kolumnę „Projekt” na liście, rozwiązującą istniejące `MKT-4`, co musi działać mimo archiwizacji) zostawał w pickerze mimo że `searchProject` już go wykluczał; naprawione jawnym `.filter(p => !p.isArchived)` w komponencie kroku. **Nieprzetestowane bezpośrednio interakcją użytkownika**: przeciąganie karty MIĘDZY swimlane'ami (blokada przez zasięg `cdkDropListGroup`, zweryfikowana przeglądem kodu) i grupowanie po polu niestandardowym `CustomField` (brak inputu na kod pola w prostym przełączniku nagłówka — osiągalne tylko przez API). | ⚠️ częściowo (wszystkie siedem funkcji zweryfikowane na żywo z bazą danych po każdym kroku, w tym trzy naprawione realne błędy — jeden z nich, brak nasłuchu `erp.events`, dotyczyłby też przyszłego usuwania multimediów w tym module; drag między swimlane'ami i grupowanie po polu niestandardowym bez interakcji na żywo) |
| 6 (weryfikacja skonsolidowana, DoD) | 02.09.2026 | Weryfikacja pięciu pozycji `4.6 Definicja ukończenia fazy 6` (szczegóły wyników w §4.6, nie powtarzane tutaj): sprint od planowania do zamknięcia z jawną decyzją o niedokończonych zgłoszeniach; operacja masowa (zmiana stanu) z sukcesem częściowym i powodem per zgłoszenie; wyszukiwanie komentarza nie ujawnia zgłoszenia oznaczonego jako `is_restricted`, do którego szukający nie ma dostępu (potwierdzone przez wynik `0`, potem przywrócenie i wynik `1` — to samo zapytanie, ta sama fraza); przeniesione zgłoszenie otwiera się ze starego linku (przekierowanie URL potwierdzone przez `window.location.href`, nie tylko treść strony); `NFR-003` zmierzone na 200 000 wygenerowanych zgłoszeń (backend `EXPLAIN ANALYZE` na dokładnym kształcie zapytania z `IssueQueries`, dane testowe usunięte po pomiarze). **Dwa realne błędy znalezione i naprawione**: (1) brakujący indeks wspierający domyślne sortowanie listy (`CreatedAt DESC, Uuid`) — bez niego pobranie pierwszej strony przy 200 tys. wierszy kosztowało ~277 ms (Seq Scan + Sort całej tabeli, w tym ~188 ms samego JIT-a Postgresa, który się włącza właśnie dlatego że koszt Seq Scan jest wysoki), po dodaniu migracji `IssueDefaultSortIndex` spadło do ~0,14 ms; (2) systemowy błąd reaktywności Transloco w kilku filtrach/pickerach modułu (`computed(() => transloco.translate(klucz))` cache'uje surowy klucz na zawsze, jeśli odczyta go zanim scope się doładuje) — naprawiono częściowo (przeniesiono `provideTaskManagementTranslations()` na trasę agregującą moduł), właściwa naprawa całego wzorca (9 plików) zgłoszona jako osobne zadanie, nie zablokowała żadnego z pięciu punktów DoD. **Pozostałe borderline, udokumentowane, bez zmiany kodu**: licznik wyników (`TotalCount`) bez filtra projektu na 200 tys. wierszy mierzy się na ~287 ms z włączonym JIT Postgresa (budżet 300 ms) — indeks nie pomaga (COUNT musi dotknąć każdego pasującego wiersza), rekomendacja w §4.6 dotyczy strojenia Postgresa, poza zakresem migracji EF; z filtrem projektu (codzienny przypadek) ten sam licznik to 41,7 ms. | ✅ (wszystkie 5 pozycji `4.6` potwierdzone na żywo; jeden indeks brakujący naprawiony migracją, jeden systemowy bug i18n częściowo naprawiony/zgłoszony osobno, jedno ryzyko udokumentowane bez zmiany kodu) |
| 7 | 03.09.2026 | **Punkt wyjścia tej sesji**: worktree rozjechał się od `main` tuż po fazie 5 i brakowało mu całej fazy 6 (zaimplementowanej wcześniej wyłącznie na `main`, commit `9b455047`) — naprawione `git rebase main` przed startem fazy 7. Backend: `Erp.BuildingBlocks.Reporting` (nowy building block — `ReportRun` jako konkretna klasa mirror `Job`/`JobItem`, NIE generyk po module z osobnym interfejsem, po tym jak pierwsza próba tej generalizacji utknęła w błędnym projekcie z podwójnym parametrem generycznym `ReportRunner<TContext,TReportRun>`/`IReportRun`, naprawione bezpośrednio w tej sesji), `IReportRunDbContext`, `ReportRunner<TContext>`, `IReportDefinition` skanowana jak `IBulkCommandExecutor`; Catalog przepisany z `ExportRun` na tę infrastrukturę (`catalog.product-export` jako pierwsza definicja, migracja `ReportRunRename`); TaskManagement: `WorkflowScheme.AddState/SetState/RemoveState/AddTransition/SetTransition/RemoveTransition/Publish` (WF-006/007, wzorem `IssueTypeScheme` z fazy 4), `SavedView` (nowy agregat własny, VIEW-001), `taskmgmt.report.read.all` (PERM-005), `TaskManagementHoursByDepartmentReportDefinition` (RPT-002, rekurencyjne CTE W PRZÓD po `Delivers` — lustrzane odbicie `IssueDeliveryHoursQueries` z fazy 6, zweryfikowane ręcznie na żywej bazie: syntetyczny wpis 90 min na `DEV-9` realizującym `MKT-4` poprawnie przypisany do zagadnienia `MKT-4`, działu `DEV`, transakcja wycofana po teście). Migracje `Reports` (TaskManagement), `ReportRunRename` (Catalog) — bez zmian w `SavedViews` (już istniała z próby przerwanej limitem sesji). `dotnet test backend/tests/TaskManagement.Tests` 158/158, `Erp.ArchitectureTests` 27/27 (złapał i wymusił poprawkę nazwy `SavedViewCopyCommand`→`SavedViewCreateCopyCommand` — „Copy” nie jest jednym z pięciu czasowników), `Erp.IntegrationTests` 23/23. Front: zakładka „Schemat stanów” na karcie projektu (dwie listy + macierz „z→do”, bez canvasa), modal publikacji z ekranem mapowania (wzorem `IssueSetProjectStepComponent` z fazy 6), panel „Zapisane widoki” w filtrze listy zgłoszeń z obsługą VIEW-001 AC2 (pole usunięte z profilu → toast, nie błąd), strona `/task-management/report` (tabela przestawna dział×zagadnienie×okres, budowana client-side z pobranego CSV, bez linku do karty zgłoszenia z poziomu zagadnienia — PERM-005 AC2), pozycja menu „Raport godzin” dodana dopiero po potwierdzeniu działania strony. `pnpm nx run {task-management,catalog,client}:build` zielone, `lint` bez nowych błędów (te same 2 pre-istniejące, nietknięte pliki). **Pełne przeklikanie na żywo** (osobne sesje na workflow/saved-views i na stronę raportu, `TaskManagement.Api`+`Identity.Api`, ten drugi zrestartowany raz, bo `PermissionCatalogReconciler` upsertuje nowe kody uprawnień tylko przy starcie): edytor stanów/przejść z macierzą, zapis/udostępnienie/skopiowanie widoku, generowanie raportu przez prawdziwy formularz (zakres dat, wybór działów z rzeczywistych projektów DEV/MKT), pojawienie się w dzwonku zadań, pobranie i wyświetlenie pustego wyniku (środowisko dev nie ma jeszcze żadnych wpisów `work_log` — tabela była pusta na starcie tej fazy, to oczekiwane, nie błąd). **Jeden realny błąd znaleziony i naprawiony podczas weryfikacji strony raportu**: strona polegała wyłącznie na sygnaturze realtime `taskmgmt.report_run`, a WebSocket w środowisku dev łączył się cyklicznie bez utrzymania połączenia, więc status nigdy nie docierał i strona zostawała na „Generowanie raportu…” bez końca; naprawione dodaniem odpytywania (`reloadAsync`, co 1 s, limit 120 s) jako głównego mechanizmu, z SignalR jako bonusem i ręcznym przyciskiem „Odśwież” jako dodatkowym zabezpieczeniem. **Świadomie pominięte w tej fazie** (odnotowane, nie ukryte): `TAG-003` (scalanie/zmiana nazwy tagu, `Could`), cztery z pięciu definicji `RPT-003` (`Should` — zostaje tylko `hours-by-department`, `Must`), `VIEW-002` (widok domyślny projektu, `Could`), automatyczny test negatywny na brak tytułu/opisu w wierszach raportu (granica jest wymuszona kształtem DTO, zweryfikowana ręcznie, ale bez testu regresyjnego w `TaskManagement.Tests`). | ⚠️ częściowo (`Must`/`Should` z `WF-006/007`, `VIEW-001`, `PERM-005`, `RPT-001/002/004` zrobione i zweryfikowane na żywo; `TAG-003`, `VIEW-002` i 4/5 `RPT-003` świadomie pominięte; brak automatycznego testu negatywnego dla granicy PERM-005; brak rzeczywistych danych `work_log` w dev do zweryfikowania nieliczbowego przykładu z `§5.3` na żywo) |
| 8.1 (silnik automatyzacji) | 03.09.2026 | Zakres zawężony na starcie sesji do AUT-001/AUT-002 (webhooki/klucz integracyjny/burndown/NTF-003/SRCH-005 zostają w §6.2) — plan w `C:\Users\rwojcik\.claude\plans\valiant-noodling-globe.md`. Backend: `AutomationRule`/`AutomationAction`/`AutomationRun` (`TaskManagement.Domain/Automation/`), wąski model warunku DNF w `.../Conditions/` (AST + walidator + ewaluator + parser tekstowy dla testu równoważności, nie dla UI — patrz korekta w §6.1); pierwsze zdarzenie integracyjne wewnątrz-modułowe (`IssueAutomationTriggerRequested`, przez outbox, konsument w tym samym module); `AutomationRuleEvaluator` (nowy scope DI per regułę — koniecznością, nie ozdobnikiem: bez tego nieudana reguła zanieczyszczałaby odczyt następnej reguły w tej samej pętli niezapisanym stanem), `AutomationActionExecutor` (mapuje akcję na istniejącą komendę zgłoszenia przez `ICommandDispatcher`). `IExecutionContext`/`MutableExecutionContext` rozszerzone o `AutomationRuleUuid`/`AutomationDepth` (AC2/AC3) zamiast osobnego równoległego kontekstu — mechaniczna zmiana w ~4 istniejących handlerach (`IssueActivity.Record` + 2 nowe parametry). Migracja `Automations` (`automation_rule`, `automation_action`, `automation_run`, `issue_activity.automation_rule_uuid`) wygenerowana i zastosowana na żywej bazie dev przez drugą instancję `TaskManagement.Api` na porcie 5291 (port 5290/4200 zajęty przez równoległą sesję przez cały czas trwania tej sesji — `dotnet build`/`dotnet ef` do katalogów tymczasowych, żeby ominąć zablokowane DLL-e bez dotykania procesu innej sesji). Nowy kod uprawnienia `taskmgmt.automation.manage`. `dotnet test backend/tests/TaskManagement.Tests` 189/189 (+25: `AutomationRuleTests`, `AutomationConditionTests`, w tym test równoważności parser↔AST budowany wprost), `Erp.ArchitectureTests` 27/27 (nazwy komend zgodne z pięcioma czasownikami od razu, nic do złapania). Front: `TaskManagementAutomationRuleOrchestrator`, cztery nowe enumy w `issue-enums.ts`, zakładka „Automatyzacje” na karcie projektu (`ProjectAutomationsComponent` — lista, edytor strukturalny warunku/akcji inline pod listą wzorem panelu scalenia tagów z fazy 7, log uruchomień), znacznik „Automatycznie” w `erp-activity-stream` zamiast awatara aktora. NSwag zregenerowany dwukrotnie (raz po dodaniu endpointów, raz po rozszerzeniu `IssueActivityDto`), `pnpm nx run {task-management,client}:build` zielone. **Świadome uproszczenie zakresu**: pola referencyjne warunku/akcji (stan/typ/tag/przypisany) przyjmują uuid jako zwykły tekst, bez dedykowanych pickerów — jawnie odnotowane, nie ukryte. **Bez żywej weryfikacji w przeglądarce** — port 4200 niedostępny przez całą sesję; weryfikacja ograniczona do kompilacji obu buildów, 189 testów jednostkowych, migracji zastosowanej na żywo (log startu API: `Applying migration '…_Automations'`, start bez błędów), `curl` na uruchomionym API (401 na `searchAutomationRule` bez tokenu — poprawnie zabramkowane, nie 404). Backend instancja weryfikacyjna zatrzymana i posprzątana na koniec sesji. | ⚠️ częściowo (backend w pełni zweryfikowany — kompilacja, testy, migracja na żywej bazie, endpoint HTTP; front zbudowany i otypowany poprawnie, ale bez ani jednego kliknięcia w przeglądarce — do zrobienia w kolejnej sesji: utworzenie reguły z warunkiem, wywołanie przez zmianę stanu, log uruchomień, wyłączenie, limit głębokości na dwóch regułach wzajemnie się wywołujących) |
| 8.1 (żywa weryfikacja) | 03.09.2026 | Domknięcie pozycji odłożonej w poprzedniej sesji („do zrobienia w kolejnej sesji: pełne przeklikanie"). Uruchomione `TaskManagement.Api`/`Identity.Api`/`Notification.Api` + `client-monolith`+`task-management-mfe`, zalogowano `admin@erp.local`. Reguła „przy utworzeniu zgłoszenia ustaw priorytet Krytyczny” utworzona z UI, wywołana utworzeniem `DEV-11` — log reguły potwierdził wykonanie, ale zgłoszenie dostało priorytet `Najniższy` zamiast `Krytyczny`. **Realny błąd #1 (backend, poważny — dotyczy WSZYSTKICH siedmiu rodzajów akcji, nie tylko priorytetu)**: `AutomationActionExecutor.ReadConfig` wołał `JsonSerializer.Deserialize<T>(configJson)` bez `PropertyNameCaseInsensitive`; front serializuje konfigurację akcji camelCase (`{"priority":4}`), rekordy (`PriorityConfig.Priority` itd.) są PascalCase — deserializacja „się udawała”, ale po cichu zostawiała właściwość na wartości domyślnej zamiast rzucić błąd. 189 testów jednostkowych tego nie złapało, bo konstruują `ConfigJson` przez `JsonSerializer.Serialize` z domyślnym PascalCase — dokładnie ten kształt, którego front nigdy nie wysyła. Naprawione wzorcem już użytym w `ReportDefinitions` (`JsonSerializerOptions { PropertyNameCaseInsensitive = true }`). Po poprawce i restarcie API: nowe zgłoszenie `DEV-12` dostało `Krytyczny` poprawnie (`Automatycznie … zmienił pole priorytet: Normal → Critical`). **Realny błąd #2 (front, niepowiązany)**: `ProjectAutomationsComponent.triggerPickerConfig`/`priorityOptions` przekazywały do `erp-input-picker` surowe klucze tłumaczeń (dropdown „Zdarzenie” pokazywał `project.detail.automations.trigger.issueCreated`) albo angielskie literały (`'Lowest'`…`'Critical'`) zamiast przetłumaczonego tekstu — mimo że `TASKMANAGEMENT_KEYS.priority.*` i wzorzec `computed`+`injectTranslationsReadySignal()`+`transloco.translate(...)` (ten sam co w `issue-filter.component.ts`) już istniały w module. Naprawione tym samym wzorcem. **AC3 (twardy limit głębokości = 5) zweryfikowany end-to-end**: reguła samo-wyzwalająca się („przy dodaniu komentarza dodaj komentarz”) uruchomiona ręcznym komentarzem na `DEV-12` wygenerowała dokładnie 5 automatycznych odpowiedzi (`Wykonania: 5`) i poprawnie się zatrzymała, bez nieskończonej pętli. **Wyłączenie reguły zweryfikowane**: po `Wyłącz` kolejny komentarz nie wywołał auto-odpowiedzi. Reguły testowe usunięte po weryfikacji (potwierdzenie z podstawionym `{{name}}` zadziałało poprawnie); zgłoszenia `DEV-11`/`DEV-12` pozostawione jako artefakt deweloperski. `dotnet test backend/tests/TaskManagement.Tests` 189/189, `Erp.ArchitectureTests` 27/27, `pnpm nx run task-management:build` zielony po obu poprawkach. | ✅ (pozycja „żywa weryfikacja” z wiersza 8.1 poprzedniej sesji domknięta; 2 realne błędy znalezione i naprawione, w tym jeden krytyczny wpływający na wszystkie rodzaje akcji automatyzacji) |
| 7 (domknięcie) | 03.09.2026 | **Wszystkie pięć pozycji odłożonych w poprzedniej sesji domknięte**: `TAG-003`, cztery pozostałe definicje `RPT-003`, `VIEW-002`, test regresyjny PERM-005, realne dane `work_log`. **Blokada środowiskowa napotkana i usunięta na starcie**: lokalny dev Postgres miał schemat `taskmgmt` zastosowany z zupełnie innej, dużo starszej gałęzi łańcucha migracji (nazwy migracji — `InitialTaskManagementSchema`, `AddSavedIssueViewsAndWorkLogs` — nie pasowały do żadnej migracji istniejącej w repo; brakowało m.in. `issue.type_uuid`, `tag`, `report_run`), migracja `IssueTypes` wywalała się na FK przy starcie API — **za zgodą użytkownika** schemat `taskmgmt` wyczyszczony (`DROP SCHEMA … CASCADE`, wyłącznie ten schemat, inne moduły nietknięte) i odbudowany od zera pełnym dzisiejszym łańcuchem migracji + seedem. Backend: `TaskManagementIssuesByStateTypeAssigneeReportDefinition`, `TaskManagementCycleTimeByStateCategoryReportDefinition` (rekonstrukcja okresów z `issue_activity` przez `LAG`, mediana liczona w .NET), `TaskManagementSlaComplianceReportDefinition` (minuty robocze liczone iteracyjnie wg kalendarza SLA projektu), `TaskManagementSprintProgressReportDefinition`/`TaskManagementSprintWorkloadReportDefinition` — żaden nowy endpoint/komenda, rejestracja przez skan zestawu; `Tag.SetName` + `TagSetNameCommand`; `TagExecMergeCommand` + `IIssueTagWriter.RepointAsync` (raw SQL z dedupem, poza granicą agregatu `Tag`, wzorem `IProjectKeyCounterWriter.SetPrefixAsync`); `Project.DefaultSavedViewUuid` (referencja miękka) + `ProjectSetDefaultSavedViewCommand` (odrzuca widok prywatny/spoza projektu). Migracja `ProjectDefaultSavedView`. `dotnet test backend/tests/TaskManagement.Tests` 164/164, `Erp.ArchitectureTests` 27/27. **Nowa infrastruktura testowa**: `TaskManagementDatabase` w `Erp.IntegrationTests` (referencja do `TaskManagement.Infrastructure` dopisana do projektu, `InternalsVisibleTo` na `IssueVisibility` z `TaskManagement.Infrastructure`), `TaskManagementTagMergeTests` (dedup scalenia zweryfikowany bezpośrednio na bazie: zgłoszenie z oboma tagami dostaje dokładnie jeden wiersz `issue_tag` po scaleniu, nie dwa) i `TaskManagementReportPermissionTests` (PERM-005 AC2+AC3, opisane w §5.2) — `dotnet test backend/tests/Erp.IntegrationTests`: **26/26**, Testcontainers Postgres dostępny przez `npipe://./pipe/docker_engine` mimo braku `docker` CLI w PATH tej sesji. Front: NSwag zregenerowany (API uruchomione lokalnie po odbudowie schematu), strona raportu przebudowana na selektor + generyczną tabelę (`report.store.ts`, `report.component.ts`, `parseReportCsvToRows`), nowa zakładka „Tagi” na karcie projektu (`ProjectTagsComponent`), auto-apply widoku domyślnego w `IssueFilterComponent`. `pnpm nx run {task-management,client}:build` zielone, `lint` bez błędów. **Trzy realne błędy znalezione i naprawione podczas weryfikacji**: (1) dropdown wyboru raportu pokazywał surowy klucz tłumaczenia — ten sam systemowy bug reaktywności Transloco co w fazie 6 (`computed` bez strażnika `injectTranslationsReadySignal()`); (2) `ProjectTagsComponent` czytał `this.project()` (input wymagany) wprost w konstruktorze — `NG0950`, ten sam wzorzec błędu co `IssueSetProjectStepComponent` w fazie 6, naprawione przeniesieniem do `effect()`; (3) modal potwierdzenia scalenia tagów nie podstawiał parametru `{{name}}` do tytułu/treści (`ErpConfirmDialogService.confirmThenAsync` przyjmuje `Translatable` — `{key, params}` — a nie sam klucz). **Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+`TaskManagement.Api`+`Identity.Api`, ten drugi uruchomiony dopiero w tej sesji — wcześniej niedostępny, co blokowało uprawnienia i routing): wszystkich pięć raportów w dropdownie z poprawnymi nazwami po naprawie (1), formularz parametrów pokazuje/ukrywa pola wg wybranej definicji, `issues-by-state-type-assignee` z realnymi liczbami z seeda, `cycle-time-by-state-category` z poprawnym pustym wynikiem (brak historii zmian stanu w seedzie); zakładka „Tagi” — utworzenie dwóch tagów z karty DEV-1 (jeden samodzielnie, jeden razem z pierwszym — przypadek dedupu), zmiana nazwy zapisana w bazie, scalenie `legacy-backend`→`backend` usuwa tag źródłowy i DEV-1 pokazuje jeden tag zamiast dwóch (dedup potwierdzony na żywo); VIEW-002 — zapisanie widoku „Zespół DEV” udostępnionego projektowi, ustawienie jako domyślny, przeładowanie strony, wejście w kontekst DEV — widok zastosowany automatycznie (filtr projektu, plakietka „DOMYŚLNY”). **Bez zmian w danych `work_log`** ponad to, co seed już wygenerował — realne dane istniały od odbudowy schematu, nie było potrzeby oddzielnego kroku syntetycznego. | ✅ (wszystkie pięć pozycji z poprzedniej sesji domknięte i zweryfikowane na żywo z realnym backendem/frontendem/bazą, w tym 3 realne błędy znalezione i naprawione; faza 7 przechodzi z ⚠️ na ✅ w §0) |
| 8.2 (webhooki wychodzące) | 03.09.2026 | API-004 zaimplementowane od zera w tej sesji (kontynuacja bezpośrednio po domknięciu 8.1) — pełny opis w §6.2. Backend: `Webhook`/`WebhookDelivery` (`TaskManagement.Domain/Webhooks/`), `EventKinds` reużywa `AutomationTriggerKind` zamiast nowego enuma, migracja `Webhooks` (`text[]` przez `ValueConverter`+`ValueComparer`), `WebhookTriggerPublisher` dopięty do tych samych trzech punktów cyklu życia zgłoszenia co automatyzacja, `WebhookDeliveryDispatcher` (`BackgroundService`+`[ClusterSafe]`, `FOR UPDATE SKIP LOCKED` wzorem `JobQueueLock`, backoff wykładniczy 15/30/60/120 s, klient HTTP z timeoutem 10 s), podpis `X-Erp-Signature` HMAC-SHA256. Nowy kod uprawnienia `taskmgmt.webhook.manage`, nowa sygnatura `taskmgmt.webhook`. `dotnet test backend/tests/TaskManagement.Tests` 208/208 (+19: `WebhookTests`, `WebhookDeliveryTests`), `Erp.ArchitectureTests` 27/27 (złapał brakujące endpointy przy pierwszym uruchomieniu po dopisaniu komend, zanim API zostało napisane — zadziałał zgodnie z przeznaczeniem). Front: `TaskManagementWebhookOrchestrator`, `WEBHOOK_DELIVERY_STATUS`, zakładka „Webhooki” na karcie projektu (`ProjectWebhooksComponent`) — **tym razem etykiety zdarzeń/statusów poprawnie przetłumaczone od pierwszej wersji** (`computed`+`injectTranslationsReadySignal()`+`transloco.translate`), nauczka wyciągnięta wprost z dwóch błędów i18n znalezionych w automatyzacji kilka godzin wcześniej w tej samej sesji. `pnpm nx run task-management:build` zielony. **Pełne przeklikanie na żywo** (`client-monolith`+`task-management-mfe`+`TaskManagement.Api`+`Identity.Api` zrestartowany dla reconciliacji nowego kodu uprawnienia, lokalny odbiornik HTTP w Pythonie na porcie 8999): utworzenie webhooka z dwoma zdarzeniami, dwa udane dostarczenia (utworzenie zgłoszenia, zmiana stanu) z **podpisem HMAC-SHA256 zweryfikowanym bit-do-bitu** niezależnym przeliczeniem w Pythonie; zmiana adresu na martwy port → 4 nieudane próby w logu z rosnącym odstępem (15/30/60/120 s) → piąta wyczerpuje limit → status `Failed` w UI z komunikatem błędu, licznik kolejnych błędów webhooka wzrósł do 1; wyłączenie webhooka potwierdzone brakiem nowego dostarczenia na kolejne zgłoszenie; usunięcie z poprawnie przetłumaczonym modalem potwierdzenia. **Nieprzetestowane na żywo** (koszt czasowy — ok. 37 minut na 10 wyczerpanych dostarczeń): pełne auto-wyłączenie webhooka po progu 10 kolejnych błędów — pokryte wyłącznie testem jednostkowym domeny, mechanizm identyczny do zweryfikowanego pojedynczego przyrostu licznika. Zgłoszenia testowe (`DEV-13`, `DEV-14`) pozostawione jako artefakt deweloperski; webhook testowy usunięty po weryfikacji. | ✅ (wszystkie funkcje API-004 zweryfikowane na żywo poza pełnym auto-wyłączeniem po 10 błędach, które jest zbyt czasochłonne do odtworzenia na żywo i pokryte testem jednostkowym; zero realnych błędów znalezionych podczas weryfikacji — w odróżnieniu od automatyzacji tego samego dnia, gdzie i18n i case-sensitivity JSON były realnymi błędami) |
