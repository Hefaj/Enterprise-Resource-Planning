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
| 5 | Zlecenia międzydziałowe, obserwujący, powiadomienia, SLA | 4 | tak (dodanie pól) | `WatchersAndIntake`, `ProjectSla` | 📐 |
| 6 | Sprinty, backlog, tagi, operacje masowe, wyszukiwanie, **rejestracja czasu** | 4 | tak (dodanie pól) | `SprintsAndBacklog`, `TagsAndResolution`, `FullTextSearch`, `WorkLogAndEstimate` | 📐 |
| 7 | Edytor schematu z UI, zapisane widoki, **raporty (w tym godziny per dział)** | 6 | tak (dodanie pól) | `SavedViews` | 📐 |
| 8 | Automatyzacje, DSL, webhooki | 7 | nie | `Automations`, `Webhooks` | 📐 |

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

- [ ] `IssueWatcher` (encja podrzędna `Issue`) + `Issue.AddWatcher`/`RemoveWatcher`
      z zapamiętaniem **jawnej rezygnacji** (`ISS-009` AC1 — bez tego kolejny komentarz dopisuje z powrotem).
- [ ] `Issue.IsRestricted` już jest — dopiąć do predykatu widoczności (`PERM-003`).
- [ ] `Issue.DerivedDeliveryState` — pole wyliczane z powiązań `realizuje` (`REQ-003`).
- [ ] `SlaPolicy` na projekcie: czas reakcji, czas realizacji, kalendarz roboczy (`PRJ-006`).
- [ ] Migracje `WatchersAndIntake`, `ProjectSla`.
- [ ] Seed: schemat stanów `Intake` (`Nowe → Przyjęte → W realizacji → Do odbioru → Odebrane`
      + `Zastrzeżenia` z powrotem) — `REQ-004` AC3.
- [ ] Indeks `(due_at) where state_category <> 'Done'` pod skan terminów.

### 3.2 Backend — aplikacja, API, zdarzenia

- [ ] `IssueAddWatcherCommand` / `IssueRemoveWatcherCommand`.
- [ ] Nasłuch zdarzenia domenowego zamknięcia zgłoszenia → przeliczenie `derived_delivery_state`
      na powiązanych zleceniach (`REQ-003`). **Zdarzenie domenowe, nie integracyjne** — ten sam moduł.
- [ ] `IssueOverdueScanService : BackgroundService` z **`[ClusterSafe(powód)]`** i dzierżawą
      `taskmgmt:issue-overdue-scan` (`REQ-005`). Bez atrybutu nie przejdzie `BackgroundServiceTests`.
- [ ] Publikacja `UserNotificationRequested` z listą odbiorców dla siedmiu zdarzeń z `NTF-002`;
      **sprawca zmiany wycięty z listy**.
- [ ] Rozszerzenie `IssueVisibility` o `is_restricted` i o wgląd z powiązania (`PERM-004`) —
      nagłówek, nie treść: osobna projekcja `IssueHeaderDto`, nie `IssueDto` z pustymi polami.
- [ ] Parsowanie wzmianek `@` przy zapisie komentarza → dopisanie obserwujących + powiadomienie.

### 3.3 Front

- [ ] `data-access`: rozszerzenie `issue.orchestrator` o obserwujących i `derivedDeliveryState`.
- [ ] `feature/issue`: sekcja obserwujących na karcie (dodaj/usuń, „obserwuję" jako przełącznik).
- [ ] `feature/issue`: wzmianki `@` w edytorze komentarza — podpowiadanie przez
      `ERP_USER_DIRECTORY` ([`user-directory.md`](docs/frontend/user-directory.md)), nie lokalnym endpointem.
- [ ] **Nowy agregat `request`** w `feature`: strona `/task-management/request`
      (`REQ-006`) + modale „złóż zlecenie", „odbierz realizację", „zgłoś zastrzeżenia".
- [ ] `feature/issue`: pasek powiązań pokazuje nagłówki zgłoszeń realizujących (`REQ-002`).
- [ ] `feature/project`: zakładka **SLA** (`PRJ-006`).
- [ ] `contract`: pozycja menu „Zlecenia" → `/task-management/request` z `taskmgmt.issue.read`.
- [ ] Tłumaczenia + `pnpm translate:keys`.

### 3.4 Definicja ukończenia fazy 5

- [ ] Zamawiający składa zlecenie w projekcie `Intake`, dev tworzy dwa zgłoszenia i wiąże je
      typem `realizuje`; zamknięcie obu zmienia stan realizacji na zleceniu **bez ręcznej akcji**.
- [ ] Zlecenie **nie zamyka się samo** — dopiero odbiór człowieka je zamyka.
- [ ] Zamawiający widzi klucz, tytuł i stan zgłoszenia dev, a `404` przy próbie wejścia na kartę.
- [ ] Wzmianka `@` w komentarzu daje powiadomienie w dzwonku odbiorcy, a nie autorowi.
- [ ] Druga instancja serwisu nie dubluje przypomnień o terminie.

---

## 4. Faza 6 — dojrzałość narzędzia

**Cel fazy:** moduł staje się użyteczny na co dzień dla zespołu, który już ma setki zgłoszeń.
Po tej fazie kończy się **MVP użytkowe**.

**Wymagania:** SPR-001..003, BULK-001..003, TAG-001/002, SRCH-003/004, ISS-007/008/010,
TIME-001/002/004, BRD-006/007/009, PRJ-003/004, ATT-002, API-005, NFR-008.

### 4.1 Sprinty i backlog

- [ ] `Sprint` (agregat): nazwa, zakres dat, cel, stan; `board_card.sprint_uuid` już istnieje.
- [ ] Indeks częściowy `unique (board_uuid) where status = 'Active'` — niezmiennik w bazie, nie w kodzie.
- [ ] `SprintCreate`, `SprintSetDates`, `SprintExecStart`, `SprintExecClose`
      (zamknięcie z **jawną decyzją** o niedokończonych — `SPR-003`).
- [ ] Front: podstrona `/task-management/board/:uuid/backlog`, dwie listy, ten sam mechanizm ranku.
- [ ] Sygnatura realtime `taskmgmt.sprint` + rejestracja w `AggregateSignatures`.

### 4.2 Tagi i rozwiązanie

- [ ] `Tag` + `issue_tag`; `taskmgmt.tag.manage` jako **nowy kod uprawnienia** (dopisać w obu
      miejscach: `Permissions.cs` i `permission-codes.ts`).
- [ ] `Issue.ResolutionUuid` + słownik rozwiązań na projekcie; wpięcie w `required_fields`
      przejścia do kategorii `Done` (`ISS-007`).
- [ ] Front: chipsy tagów na liście i karcie, filtr po tagach, wybór rozwiązania w modalu przejścia.

### 4.3 Operacje masowe

- [ ] Egzekutory dla siedmiu operacji z `BULK-002`, każdy z własnym zestawem `IBatchRule`.
- [ ] Przeniesienie do projektu (`ISS-010`) — nadanie nowych kluczy z puli, zapis
      `previous_keys`, przeniesienie dzieci, **ekran decyzji o polach bez odpowiednika**.
- [ ] Front: pełny `ErpSelectionScope` na liście zgłoszeń + modal podsumowania zadania masowego.
- [ ] Przekierowanie ze starego klucza na bieżący na trasie karty (`ISS-010` AC2).

### 4.4 Rejestracja czasu — dane dla raportu z fazy 7

Ta podsekcja jest **warunkiem koniecznym fazy 7**: raport godzin nie policzy niczego wstecz.

- [ ] `WorkLog` (encja podrzędna `Issue`) + `Issue.EstimateMinutes`; migracja `WorkLogAndEstimate`.
- [ ] Słownik rodzajów pracy na projekcie (`Rozwój`/`Testy`/`Analiza`/`Spotkanie`) — `TIME-001` AC2.
- [ ] `IssueAddWorkLogCommand`, `IssueRemoveWorkLogCommand`, `IssueSetEstimateCommand`.
- [ ] Zapytanie agregujące **po łańcuchu `realizuje`** rekurencyjnym CTE (`TIME-004`) — pisane
      teraz, nie w fazie 7, bo to ono decyduje o kształcie indeksów.
- [ ] Front: sekcja czasu na karcie zgłoszenia, dodanie wpisu w **dwóch kliknięciach**
      (`TIME-001` AC3), suma wpisów obok estymaty w panelu pól.
- [ ] Wpisy czasu wchodzą do strumienia aktywności jako filtr `Czas` (§9.1 dokumentu stron).

> **Granica z kadrami** (`TIME-003`): żadnego endpointu „godziny pracownika X w miesiącu".
> Agregacja idzie po zgłoszeniu, projekcie i zagadnieniu — nigdy po osobie jako podmiocie raportu.

### 4.5 Wyszukiwanie, tablica, projekt

- [ ] Indeks GIN + `SearchIssueFullText` z predykatem widoczności **w tym samym zapytaniu** (`SRCH-003`).
- [ ] Skok do klucza w wyszukiwarce (`SRCH-004`).
- [ ] Swimlane'y (`BRD-006`) i limity WIP jako sygnał wizualny (`BRD-007`).
- [ ] Lista tablic + przekierowanie przy jednej tablicy (`BRD-009`).
- [ ] Archiwizacja projektu (`PRJ-004`) i zmiana prefiksu (`PRJ-003`).
- [ ] Usunięcie pojedynczego załącznika (`ATT-002`) — z prefiksem postojowym, nie gołym `DELETE`.
- [ ] Linki zewnętrzne na zgłoszeniu (`API-005`).

### 4.6 Definicja ukończenia fazy 6

- [ ] Zespół prowadzi sprint od planowania do zamknięcia; niedokończone zgłoszenia trafiają tam,
      gdzie użytkownik wskazał, a nie tam, gdzie system uznał.
- [ ] Zmiana stanu na 300 zaznaczonych zgłoszeniach kończy się sukcesem częściowym z listą
      odrzuconych i powodem per zgłoszenie.
- [ ] Wyszukiwanie frazy w komentarzach nie pokazuje zgłoszeń spoza uprawnień.
- [ ] Przeniesiony `DEV-412` otwiera się ze starego linku.
- [ ] `NFR-003` zmierzone na 200 tys. zgłoszeń — wynik zapisany w tym pliku.

---

## 5. Faza 7 — konfiguracja z UI i raporty

**Wymagania:** WF-006/007, VIEW-001/002, RPT-001..003, PERM-005, TAG-003.

### 5.1 Konfiguracja z UI

- [ ] Edytor schematu stanów: dwie listy + macierz „z → do" (`WF-007`), **nie canvas**.
- [ ] Publikacja schematu z modalem mapowania stanów → zadanie masowe (`WF-006`).
- [ ] `SavedView` (filtr + sortowanie + kolumny + tryb), prywatny lub projektowy (`VIEW-001`);
      widok z usuniętym polem otwiera się z komunikatem, nie błędem.
- [ ] Scalanie i zmiana nazwy tagu (`TAG-003`).

### 5.2 Raporty — ekran kierownictwa

Wchodzi tu, a nie w fazie 8, bo dyrektor IT jest **aktorem systemu**, nie odbiorcą rozszerzeń.
Dane zbierają się od fazy 6 (`TIME-001`), więc raport ma z czego liczyć od pierwszego dnia.

- [ ] `taskmgmt.report.read.all` — nowy kod uprawnienia w `Permissions.cs`
      **i** w `permission-codes.ts` (`PERM-005`).
- [ ] `IReportDefinition` dla rozliczenia godzin (`RPT-002`): wiersze = dział/projekt,
      kolumny = okres, rozwinięcie = zagadnienie po łańcuchu `realizuje`.
- [ ] **Zapytania raportowe nie zwracają tytułu ani opisu zgłoszenia** (`PERM-005` AC2/AC3) —
      to jest granica, która oddziela raport od obejścia widoczności. Test negatywny obowiązkowy.
- [ ] Rozróżnienie „brak danych" od „zero godzin" w projekcji (`RPT-002` AC4).
- [ ] Cztery pozostałe definicje z `RPT-003`.
- [ ] Front: strona raportu jako tabela przestawna
      ([§9.4 dokumentu stron](docs/frontend/task-management-pages.md#94-raport-godzin-faza-7)),
      eksport do artefaktu istniejącym mechanizmem.
- [ ] `contract`: pozycja menu „Raporty" z `requiredPermission` — **dopiero teraz**, gdy strona
      działa i ma dane (`RPT-004`).

### 5.3 Definicja ukończenia fazy 7

- [ ] Nowy projekt z własnym automatem stanów powstaje **wyłącznie z UI**, bez dotykania seeda
      i bez wdrożenia.
- [ ] Dyrektor IT bez członkostwa w żadnym projekcie otwiera raport i widzi „dział WMS — 142 h
      na zagadnieniu LOG-14"; kliknięcie **nie otwiera** listy zgłoszeń WMS.
- [ ] Godziny zalogowane w projekcie wykonawczym na zgłoszeniu realizującym zlecenie liczą się
      do zagadnienia tego zlecenia, a nie tylko do projektu wykonawczego.
- [ ] **Kontrola granicy z kadrami** (`TIME-003`): przegląd, czy nie powstał żaden endpoint ani
      raport, którego podmiotem jest pracownik, a nie praca.

---

## 6. Faza 8 — rozszerzenia

**Wymagania:** AUT-001/002, SRCH-005, API-003/004/006, SPR-004, NTF-003.

- [ ] Silnik automatyzacji: `when` → `if` (język warunków z `guard`) → `then` (zamknięta lista
      akcji). Twardy limit głębokości łańcucha; efekt oznaczony w historii jako automatyczny.
- [ ] Parser DSL → **ten sam obiekt filtra**, co formularz; test równoważności obu dróg.
- [ ] Webhooki przez outbox, z ponowieniami i wyłączeniem po serii błędów.
- [ ] Klucz integracyjny jako klient Keycloak z własnym zestawem uprawnień.
- [ ] Burndown z historii zmian stanów (`SPR-004`), na tej samej infrastrukturze raportowej.
- [ ] Preferencje powiadomień per projekt (`NTF-003`).

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
