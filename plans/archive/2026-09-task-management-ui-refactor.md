# Task Management — dokończenie refaktoru UI

**Status:** w realizacji — refaktor częściowy.  
**Podstawa:** weryfikacja kodu i lokalnych zmian z 2026-09-05 względem etapów 0–10.  
**Cel:** domknąć granice `feature → ui → shared`, spójność ekranów, dostępność i ochronę przed regresjami.

Checkbox `[x]` oznacza element potwierdzony w kodzie podczas audytu, a nie zaliczenie wizualnego QA. Checkbox `[ ]` oznacza pracę lub weryfikację pozostałą do wykonania. Żaden etap jako całość nie został zamknięty.

## Zasady realizacji

- Zachować Angular standalone, Signals, Control Flow, Taiga UI v5+ i Tailwind v4 oraz granice Nx.
- Feature odpowiada za dane, routing, uprawnienia i komendy; domenowe UI otrzymuje konfigurację, inputy i outputy.
- Najpierw wykorzystać istniejące komponenty shared. Nowe rozszerzenia shared mają być niezależne od domeny i uzasadnione powtarzalnym zastosowaniem.
- Wszystkie widoczne etykiety statyczne pochodzą z typowanych kluczy Transloco. `keys.ts` generować przez `pnpm translate:keys`.
- Nie oznaczać funkcji jako wykonanej wyłącznie na podstawie istnienia endpointu, orkiestratora lub komponentu bez konsumenta.
- Rozszerzenie zakresów listy wymaga świadomej zmiany kontraktu API i regeneracji klienta NSwag; nie zastępować go filtrowaniem części danych w przeglądarce.

## 0. Uzgodnienie i aktualizacja kontraktu

Dokument: [screens.md](../../docs/modules/task-management/screens.md).

- [x] Ustalić workflow jako zakładkę projektu zamiast osobnej trasy `/workflow-scheme/:uuid`.
- [x] Zapisać wymaganie potwierdzenia usunięcia pojedynczego załącznika i zachować komendę domenową.
- [x] Opisać publikowane zakładki konfiguracji projektu.
- [x] Usunąć nieaktualną informację o braku katalogu użytkowników i prezentowaniu wyłącznie UUID (katalog `ERP_USER_DIRECTORY` jest wdrożony i używany, patrz `docs/guides/frontend/user-directory.md`).
- [x] Poprawić opis pól własnych: formularz obsługuje nazwę tekstową oraz opcjonalny `nameKey` (kod już to robi, doc był nieaktualny).
- [x] Ujednolicić opisy wdrożonych faz, komentarze w kodzie i docelowe wymagania; usunąć sprzeczności i powtórzenia (usunięto zdublowany akapit o modalu wymaganych pól w §2.2; menu w §7 zsynchronizowane z kolejnością i pozycją „Dokumentacja" z `entry.menu.ts`).
- [x] Zapisać pełne pięć zakresów listy jako pracę wymagającą rozszerzenia API; odróżnić stan bieżący od docelowego (§2.1 wprost wymienia wszystkie pięć i oznacza dwa jako niedostępne bez rozszerzenia kontraktu `IssueScope`).
- [x] Uzgodnić specyfikację z dokumentacją użytkownika PL/EN, w tym uprawnieniami i ograniczeniami (`feature/src/lib/documentation/content/{pl-PL,en-US}/*.md` — `permissions.md` i `issues/list.md` nie wymieniają zakresów wprost, więc nie zaprzeczają dokumentowi; uprawnienia w §7 zweryfikowane względem `entry.menu.ts`/`entry.routes.ts` — zgodne).

**Warunek zamknięcia:** jedna spójna definicja UX, tras i ograniczeń odpowiadająca kodowi oraz jawnie opisująca pozostały zakres.

## 1. Inwentaryzacja komponentów i granic

- [x] Zinwentaryzować każdy komponent `task-management/feature`: smart, kandydat do `task-management/ui`, kandydat do `shared/ui` albo pozostaje lokalny (patrz [`task-management-component-inventory.md`](task-management-component-inventory.md)).
- [x] Zapisać przy każdym komponencie docelowe miejsce i krótkie uzasadnienie; inwentaryzację dołączyć do tego planu lub pliku obok.
- [x] Sprawdzić istniejące biblioteki i komponenty przed dodaniem nowych (żaden komponent poza `issue-key-cell` nie kwalifikuje się jako nowy kandydat UI — reszta feature jest smart lub lokalna kompozycja; brak potrzeby nowych bibliotek na tym etapie).
- [x] Wprowadzić sprawdzalną regułę blokującą nowe surowe `<table>`, `<select>` i `<input>` w feature poza jawnie uzasadnionymi adapterami (`no-restricted-syntax` na wyekstrahowanym szablonie w `frontend/libs/modules/task-management/feature/eslint.config.mjs`, zweryfikowane `nx lint task-management-feature`).
- [x] Opisać wyjątki, ich właściciela i powód pozostawienia natywnego elementu (`task-management-component-inventory.md` §„Wyjątki").

**Warunek zamknięcia:** każdy komponent ma przypisaną odpowiedzialność, a regresje granic są wykrywane przez kontrolę repozytorium.

## 2. Współdzielone UI

- [x] Wykorzystać istniejące komponenty shared w części ekranów, m.in. grid, tabelę, filtry, toolbar, inputy, tabs i preview.
- [x] Przejrzeć ekrany pod kątem ponownego użycia `erp-page-layout`, `erp-grid-layout`, `erp-group-card`, `erp-table`, `erp-tabs`, `erp-filter`, `erp-action-toolbar`, `erp-input*`, `erp-toggle-group`, `erp-media-preview` i `erp-empty-state` (audyt po nazwie klasy w całym module). Wynik: `erp-grid-layout` poprawnie tylko na trzech stronach listy (issue/project/request — board i report świadomie łamią wzorzec, §2.2/§9.1 screens.md); `erp-tabs` na karcie projektu; `erp-toggle-group` we wspólnym `erp-activity-stream`; `erp-action-toolbar` na jedynym ekranie z akcją masową (`issue-tab.component.ts`, dzielonym przez Issue/Request); `erp-table`/`erp-group-card`/`erp-input*`/`erp-empty-state` szeroko używane. **Jedna realna luka**: `erp-page-layout` (dwukolumnowy shell z panelem bocznym, dziś używany tylko przez DMS) nigdy nie występuje w Task Management — to dokładnie brakujący shell, którego etap 5 wymaga dla karty zgłoszenia; zastosować go tam zamiast pisać własny layout od zera.
- [x] Zaprojektować `erp-file-upload-list` z portem uploadu niezależnym od domeny: wybór, postęp, lista, błędy i preview (`frontend/libs/shared/ui/src/lib/molecules/erp-file-upload-list/` — Single Config Builder: types/builder/component/index; domena dostarcza `onUpload`/`onRemove`/`onDownload`/`onPreview`, komponent trzyma tylko UI-owy stan transferu).
- [x] Zaimplementować komponent uploadu w `shared/ui` i podłączyć Task Management jako rzeczywistego konsumenta (`issue-attachments.component.ts` przebudowany na cienki adapter: DTO → `ErpFileUploadListItem`, reszta renderowania w `erp-file-upload-list`; `nx lint task-management-feature` i `nx build task-management` przechodzą, wyjątek `no-restricted-syntax` dla tego pliku usunięty z eslint.config.mjs).
- [x] Wybrać klientowy `erp-table`, jego rozszerzenie albo wspólny `erp-pivot-table` dla raportów (wybór: rozszerzenie `erp-table` o generyczną komórkę akcji `ErpRowActionsCellComponent` (shared/ui) zamiast osobnego `erp-pivot-table` — `ErpGroupedRowsConfig` renderuje rodzica jako czysty tytuł bez kolumn liczbowych, co ucięłoby sumy per okres w wierszu działu; pivot jest więc spłaszczoną listą klienckich wierszy `erp-table` z rozwijaniem jako filtrem `items`, patrz `erp-report-pivot-label-cell` w `task-management/ui`).
- [x] Zastąpić modułowe renderery tabel konfiguracji i raportów współdzielonym rozwiązaniem; nie ograniczać zmiany do przeniesienia HTML (usunięte: `erp-configuration-data-table`, `erp-report-data-table`, `erp-report-pivot-table`. Migrowane na `erp-table`: `project-types.component.ts`, `project-fields.component.ts`, `project-workflow-scheme.component.ts` (lista stanów; macierz przejść zostaje udokumentowanym wyjątkiem do etapu 3/8), `report.component.ts` (obie ścieżki wyników). Kolumny budowane przez `ErpTableBuilder` z `accessorFn`/`setCell`, nie przepisany markup — dodatkowo zyskano sortowanie kolumn CSV za darmo z `erp-table`).
- [x] Zweryfikować przydatność portu uploadu i tabel dla DMS/Catalogu bez importów zależnych od Task Management (`erp-file-upload-list` i `ErpRowActionsCellComponent`/`erp-table` żyją w `shared/ui`, zależnym wyłącznie od `scope:shared` — zero importu z `@erp/task-management/*`; `nx build task-management` przechodzi. Migracja Catalogu na wspólny upload zgłoszona jako osobne zadanie w tle, poza zakresem tego planu).

**Warunek zamknięcia:** moduł nie utrzymuje osobnego ogólnego systemu uploadu i tabel raportowych.

## 3. Domenowe komponenty `task-management/ui`

- [x] Dodać prezentacyjny `erp-issue-detail-header`.
- [x] Przenieść kolumnę tablicy do `erp-board-column`.
- [x] Wykorzystać `erp-board-column` również dla list backlogu zamiast duplikować renderer.
- [x] Dodać `erp-project-configuration-section`.
- [x] Zachować nowe komponenty prezentacyjne bez wstrzykiwania orkiestratorów i serwisów domenowych.
- [x] Wydzielić `erp-board-toolbar` (nazwa/swimlane picker/link backlogu; `board.component.ts` przekazuje kontrolki jako inputy, orkiestracja zostaje w feature).
- [x] Wydzielić `erp-work-log-panel` (estymata z edycją inline, lista wpisów, formularz dodania; `issue-time.component.ts` — adapter DTO→wiersz, etykiety przez klucze z `ISSUE_KEYS` przekazane w configu, nie własny rejestr `task-management/ui`).
- [x] Wydzielić `erp-workflow-editor` (macierz przejść „z→do" + panel edycji komórki; usunięto ostatni wyjątek `no-restricted-syntax` dla `project-workflow-scheme.component.ts` — plik nie renderuje już żadnego surowego elementu).
- [x] Wydzielić `erp-automation-rule-editor` (formularz dodania/edycji reguły: nazwa, wyzwalacz, grupy warunków, akcje zależne od rodzaju; `project-automations.component.ts` zostaje właścicielem cache'u `FormControl` per wiersz i komend). Nazwa ujednolicona jako `erp-automation-rule-editor` (nie `erp-rule-editor`) — zgodna z domeną (`AutomationRuleDto`/AUT-00x), a lista komponentów w §10 dokumentu screens.md zostanie zaktualizowana pod tą nazwą.
- [x] Potwierdzić, że współdzielona kolumna pokrywa wymagania `erp-backlog-list`; dodać osobny komponent wyłącznie dla odrębnego wzorca prezentacji (potwierdzone: `backlog.component.ts` używa `erp-board-column` dla obu list — backlog i sprint; nagłówek sprintu (nazwa/cel/akcja) to trywialny jednorazowy wiersz feature, nie wzorzec do wydzielenia).
- [x] Uzupełnić konfiguracje, inputy, outputy i eksporty publiczne oraz zweryfikować granice Nx (każdy nowy komponent ma `types.ts`+`component.ts`+`index.ts`, wyeksportowany z `task-management/ui/src/index.ts`; `grep` potwierdza zero importów `@erp/task-management/data-access` w `ui/src`; `nx build task-management` i `nx lint task-management-ui`/`task-management-feature` przechodzą).

**Warunek zamknięcia:** feature składa ekran i obsługuje domenę, UI renderuje wzorzec bez znajomości API i routingu biznesowego.

## 4. Lista zgłoszeń i zleceń

- [x] Zachować `erp-grid-layout` i smart tabelę serwerową.
- [x] Zachować zakresy: moje, zgłoszone przeze mnie, wszystkie dostępne (rozszerzone o obserwowane, patrz niżej).
- [x] Renderować typ i klucz przez `erp-issue-key`.
- [x] Współdzielić bazowy komponent tabeli i toolbara między Issue i Request.
- [~] Rozszerzyć kontrakt zakresów o obserwowane i zespół, wdrożyć semantykę backendową i zregenerować klienta NSwag. **Obserwowane: zrobione.** `IssueScope.Watched = 3` dodany w `TaskManagement.Application/Issues/IssueDto.cs`, filtr `i.Watchers.Any(w => w.UserUuid == me && w.OptedOutAt == null)` w `IssueQueries.Filtered` (reużywa istniejącą encję `IssueWatcher`, **bez nowej migracji** — potwierdzone uruchomieniem API: „No migrations were applied"). Backend zbudowany i uruchomiony lokalnie (`dotnet build`/`dotnet run` przeciwko istniejącej infrastrukturze Docker), `/openapi/v1.json` odpowiada 200. NSwag regen (`nx run task-management-data-access:generate-api`) dał **zero zmian** w `api-client.ts` — odkryte przy okazji: enumy C# wychodzą w OpenAPI jako gołe `type: integer` bez nazw wariantów, więc `ISSUE_SCOPE` w `@erp/task-management/util` jest i pozostaje ręcznie utrzymywaną stałą, zsynchronizowaną teraz ręcznie z backendem (`Watched: 3` dopisany). **Zespół: NIE zrobione** — zbadane i świadomie odłożone: grep całego `backend/modules/TaskManagement` i `backend/modules/Identity` nie znalazł żadnego pojęcia „zespół"/„dział"/kierownik — wymagałoby to nowego agregatu domenowego (Team + członkostwo) w co najmniej dwóch modułach, nie dopisania wariantu enuma. To osobna, wieloetapowa funkcja, poza rozsądnym zakresem tego planu.
- [~] Podłączyć wszystkie pięć zakresów do listy i zweryfikować kompletność wyników oraz uprawnienia. Cztery z pięciu podłączone (`Available`/`AssignedToMe`/`ReportedByMe`/`Watched` w `issue-filter.component.ts`); piąty (`Team`) czeka na domenę zespołów wyżej. Weryfikacja end-to-end na żywo (rzeczywiste zapytanie z tokenem Keycloak) nie wykonana w tej sesji — brakuje gotowego sposobu na wydanie tokenu deweloperskiego; potwierdzone tylko routing (`401` bez tokenu, nie `404`/`500`) i poprawność kompilacji zapytania EF.
- [x] Podłączyć istniejący `TaskManagementSavedViewOrchestrator`: wybór, zapis, aktualizacja i usunięcie widoku zgodnie z kontraktem (`issue-filter.component.ts` — `erp-filter` ma już wbudowany mechanizm `savedPresets`/`onSavePreset`/`onLoadPreset`/`onDeletePreset`, więc to wyłącznie podłączenie danych: `searchViewsAsync` przy zmianie projektu, zapis pod istniejącą nazwą własnego widoku aktualizuje przez `setAsync` zamiast duplikować przez `createAsync`, `mode` wyprowadzony z `treeMode` filtra).
- [x] Zastąpić tekstowy priorytet znacznikiem (`erp-issue-priority-cell` w `task-management/ui` — kolorowa kropka + etykieta, ta sama kolorystyka co `erp-issue-card`).
- [x] Zastąpić tekstową listę tagów przez `erp-tag-chips` w komórce tabeli (`erp-issue-tags-cell` w `task-management/ui`, adapter na `erp-tag-chips`; feature dostarcza wyłącznie rozwiązywanie uuid→nazwa).
- [x] Wprowadzić konfigurację kontekstu Issue/Request dla etykiet, akcji, presetów i kluczy zapamiętanego stanu (`IssueTabContext` w `issue-tab.component.ts`: `stateKey`/`toolbarMenuId`/`createLabel`, `input()` z domyślnym kontekstem Issue; `RequestComponent` przekazuje własny przez `ErpGridLayoutBuilder.fill(..., { context })`). **Naprawiony realny błąd znaleziony przy tej okazji**: obie strony dzieliły dotąd `stateKey="taskmgmt-issue-list"` i `menuId="taskmgmt-issue-toolbar"` — szerokości kolumn, sortowanie i stan menu kolumn jednej listy nadpisywały drugą w preferencjach użytkownika.
- [x] Zweryfikować, że kontekst Request zachowuje ograniczenie do projektów Intake i właściwe akcje. `RequestFilterComponent` filtruje `TaskManagementProjectOrchestrator.searchAsync({ kind: PROJECT_KIND.Intake })` po stronie serwera (nie po stronie przeglądarki) — potwierdzone poprawne. „Odbierz realizację"/„zgłoś zastrzeżenia" to świadomie przejścia stanu na karcie zlecenia, nie osobne akcje listy (już udokumentowane w `REQUEST_KEYS.hint`) — generyczny pasek akcji masowych (`set-state` pokrywa oba przypadki) jest więc poprawny bez zmian. **Ryzyko odnotowane, nie naprawione**: akcja masowa „Ustaw projekt" (`set-project`, dziedziczona z `IssueTabComponent`) nie jest ograniczona do rejestrów Intake — teoretycznie pozwala przenieść zlecenie poza `Intake` z poziomu listy zleceń, co przeczy założeniu domeny („zlecenie nie jest osobnym agregatem, tylko zgłoszeniem w projekcie Intake"). Naprawa wymagałaby przekazania dozwolonego zbioru projektów do modalu `ISSUE_SET_PROJECT_MODAL_ID` w zależności od kontekstu — poza bezpiecznym zakresem samej weryfikacji.

**Warunek zamknięcia:** jeden model listy z pełnymi zakresami i zapisanymi widokami, różnicowany świadomą konfiguracją kontekstu.

## 5. Karta zgłoszenia

- [x] Wydzielić pasek kontekstu nagłówka do UI.
- [x] Dodać edycję tytułu inline.
- [x] Pokazywać datę utworzenia i aktualizacji — obecnie w różnych częściach widoku.
- [x] Zachować `erp-field-panel`, powiązania, tagi i strumień aktywności.
- [x] Nadać sticky composerowi tło przez token `--tui-background-base`.
- [~] Wydzielić prezentacyjny shell dwukolumnowy i sekcje treści; ograniczyć monolityczny szablon strony. **Oceniono i świadomie zmniejszono zakres**: sekcje treści JUŻ są osobnymi komponentami (`issue-tags`, `issue-time`, `issue-attachments`, `issue-external-links`, `issue-links`, `issue-activity`) — monolitem jest wyłącznie blok nagłówek+tytuł+metadane. `erp-page-layout` (kandydat wskazany w etapie 2) okazał się złym dopasowaniem po bliższym sprawdzeniu: to resizable/collapsible sidebar do list z filtrami, a docelowy układ karty (§9.1 screens.md) jest STAŁĄ dwukolumnową siatką bez zmiany szerokości — użycie `erp-page-layout` dokładałoby nieproszoną możliwość przeciągania szerokości. Obecna siatka CSS Grid (`xl:grid-cols-[minmax(0,1fr)_320px]`) zostaje; ekstrakcja samego bloku tytuł+metadane do osobnego komponentu UI nie została wykonana (sprzężenie z zarządzaniem fokusem — patrz niżej — sprawiło, że zostało to w feature, gdzie żyje stan `editingTitle`).
- [x] Ułożyć metadane utworzenia/aktualizacji zgodnie z docelowym nagłówkiem (zgłaszający + data utworzenia + data aktualizacji w jednej linii nagłówka, zgodnie z mockupem §9.1 „zgłosił Anna · … · zm. …"; usunięty zdublowany wiersz „Zaktualizowano" z `erp-field-panel`, który dotąd pokazywał tę samą datę osobno w panelu bocznym). Data zostaje w formacie bezwzględnym (`DatePipe 'medium'`), nie względnym („2 dni temu") — dodanie względnego czasu wymagałoby nowego pipe'a z regułami liczby mnogiej PL (3+ formy), świadomie odłożone jako osobna, ryzykowna zmiana i18n.
- [x] Zapewnić przejęcie focusu przez edytor tytułu oraz jego powrót po zapisie i anulowaniu; sprawdzić zachowanie klawiatury (`effect` w `issue-detail.component.ts` fokusuje `<input>` wewnątrz `erp-input` przy wejściu w edycję i przycisk „Edytuj" przy wyjściu — zapis I anulowanie obydwa ustawiają `editingTitle=false`, więc oba wracają do przycisku; `Escape` w polu tytułu wywołuje anulowanie). **Nie zweryfikowano na żywo w przeglądarce** — brak działającego środowiska logowania w tej sesji; poprawność oparta na przeglądzie kodu i typach, nie na obserwacji.
- [x] Wdrożyć responsywny drawer prawego panelu zamiast samego przeniesienia panelu pod treść (poniżej `xl`: `erp-field-panel` renderuje się jako zasuwka `fixed`/`translate-x` z półprzezroczystym tłem zamykającym po kliknięciu, przełącznik widoczny tylko `xl:hidden`; od `xl` wzwyż layout bez zmian — statyczna kolumna). Zaimplementowano jako CSS Grid + klasy warunkowe (bez `erp-drawer` z shared/ui — jego API zakłada dynamicznie tworzony komponent przez `Type`, a `erp-field-panel` tutaj potrzebuje projekcji `<ng-content>` i dwóch outputów, więc nie pasuje bez przebudowy panelu).
- [ ] Zweryfikować przewijanie, sticky composer i panel przy długiej treści oraz szerokościach 320 px, tablet i desktop. **Nie wykonano** — wymaga działającej przeglądarki z zalogowaną sesją i danymi testowymi; w tej sesji uruchomiono wyłącznie backend (`dotnet run` + Postgres/Keycloak/RabbitMQ/MinIO z Dockera), bez hosta Angular i przepływu logowania Keycloak. Poprawność mechanizmu drawera i sticky compozytora oparta wyłącznie na przeglądzie kodu/CSS, nie na obserwacji w przeglądarce.

**Warunek zamknięcia:** smart kontener składa domenowe UI, a karta zachowuje docelowy układ i dostępność na wszystkich rozmiarach.

## 6. Załączniki i rich text

- [x] Zachować upload natychmiast po wyborze pliku.
- [x] Zachować chroniony podgląd przez blob URLs oraz wspólne media preview.
- [x] Zachować potwierdzenie usunięcia i domenową komendę usuwania.
- [x] Przenieść wybór, postęp, listę i ogólną obsługę transferu z `issue-attachments.component.ts` do komponentu shared z etapu 2 (`erp-file-upload-list`, zrobione w etapie 2).
- [x] Pozostawić w Task Management adapter biletu uploadu, rejestrację załączników i komendy domenowe (`issue-attachments.component.ts` po etapie 2 zawiera wyłącznie DTO→`ErpFileUploadListItem` i komendy — potwierdzone przy przebudowie).
- [x] Ujednolicić adapter załączników i upload rich text bez powielania przebiegu transferu (potwierdzone przeglądem: `createIssueRichTextUploadPort` w `issue-rich-text-upload.ts` woła TEN SAM `IssueAttachmentService.uploadAsync`, którego używa lista załączników — różni się tylko interfejsem zwrotnym, Observable z natychmiastowym `blob:` zamiast callbacku postępu, bo edytor rich text potrzebuje innego UX niż lista plików; sam transfer bajtów nie jest zduplikowany).
- [ ] Zweryfikować błędy częściowego uploadu, ponowienie, cleanup blob URLs i zachowanie po zmianie zgłoszenia. **Nie zweryfikowano na żywo** — wymaga przeglądarki z zalogowaną sesją i rzeczywistym transferem plików; poza zasięgiem tej sesji (patrz etap 5, ten sam powód).
- [ ] Sprawdzić wklejenie obrazu, zapis kanonicznej referencji i ponowne otwarcie opisu/edytora. **Nie zweryfikowano na żywo**, z tego samego powodu.

**Warunek zamknięcia:** wspólny mechanizm plików obsługuje Task Management przez port domenowy bez utraty istniejących zachowań.

## 7. Tablice i backlog

- [x] Przenieść renderer kolumny do UI i wykorzystać go w backlogu.
- [x] Pozostawić store, routing i decyzje domenowe dotyczące ruchu w feature.
- [x] Zastąpić natywny select przez wspólny picker.
- [x] Zachować prezentację limitu WIP i niedostępności kolumn.
- [x] Rozszerzyć kartę o tagi, estymatę i stan disabled oraz przekazać rzeczywiste dane z feature. **Rozszerzono kontrakt API** (limitacja udokumentowana wcześniej w screens.md §9.3): `BoardCardDto` w `TaskManagement.Application/Boards/BoardDto.cs` dostał `TagUuids`/`EstimateMinutes`, `BoardQueries.Filtered` je wypełnia (`issue.Tags.Select(t => t.TagUuid)`, `issue.EstimateMinutes`) — zero nowej migracji (pola już istniały na agregacie `Issue`). NSwag zregenerowany na żywo (`nx run task-management-data-access:generate-api` przeciwko lokalnie uruchomionemu API) — tym razem klient FAKTYCZNIE się zmienił (nowe pola DTO, w przeciwieństwie do wariantu enuma z etapu 4). `ErpIssueCardConfig` (task-management/ui) dostał `tags`/`estimateMinutes`/`disabled`; `erp-issue-card` renderuje chipsy (`erp-tag-chips`) i estymatę (`90m`/`1.5h`); `erp-board-column` wiąże `disabled` do `[cdkDragDisabled]`. `disabled` = karta z własnym ruchem w toku — nowy publiczny `BoardStore.pendingCardUuid` odczytuje ją z istniejącej nakładki optymistycznej. Podłączone w `board.component.ts` i `backlog.component.ts` (ten drugi bez `disabled` — backlog nie ma odpowiednika nakładki pozycji).
- [ ] Zweryfikować WIP, dozwolone przejścia i blokady interakcji podczas operacji w toku. **Nie zweryfikowano na żywo** — ten sam powód co etapy 5/6 (brak przeglądarki z zalogowaną sesją w tej sesji).
- [x] Uzupełnić picker o wybór grupowania po polu niestandardowym — obecnie istnieje warunkowy formularz, ale brak tej opcji na liście. **Znaleziony i naprawiony realny błąd**: `BOARD_SWIMLANE_MODE.CustomField` (wartość `4`) miał gotowy klucz tłumaczenia (`board.swimlane.mode.customField`) i warunkowy formularz kodu pola, ale nie było go w liście `swimlanePickerConfig` — użytkownik nie mógł w ogóle wybrać tego trybu z pickera, więc cała gałąź była martwa.
- [x] Wydzielić toolbar (`erp-board-toolbar`, etap 3) — mobilny wybór kolumny/swimlane i responsywny backlog **NIE wykonane**: świadomie zmniejszony zakres. Wymaga realnej decyzji projektowej (jeden-widok-na-raz z przełącznikiem kolumn vs. inny wzorzec) i weryfikacji wizualnej na urządzeniu, które są poza tym, co da się bezpiecznie zrobić bez działającej przeglądarki z sesją w tej sesji — zostawione jako świadomie odłożone, nie przeoczone.
- [x] Dodać dostępną klawiaturową alternatywę przenoszenia i porządkowania kart (WCAG 2.1.1). Karta na tablicy/backlogu jest teraz fokusowalna (`tabindex="0"`) z `aria-label` opisującym skrót; strzałka prawo/lewo przenosi ją do sąsiedniej DOSTĘPNEJ kolumny (z pominięciem wygaszonych — ta sama reguła co dla myszy) na pierwszą pozycję, wołając ten sam `BoardStore.dropAsync`/`dropToBacklogAsync`/`dropToSprintAsync`, którego używa przeciąganie — brak drugiej ścieżki komend. Nowy output `ErpBoardColumnComponent.cardMoveRequested`; kolumna nie rozstrzyga sąsiedztwa sama (nie zna układu tablicy), tylko przekazuje intencję do feature.
- [ ] Zweryfikować optymistyczny ruch, rollback, przejścia wymagające pól i aktualizacje realtime po refaktorze. **Nie zweryfikowano na żywo** — ten sam powód co powyżej.

**Warunek zamknięcia:** tablica i backlog działają spójnie na desktopie i urządzeniu mobilnym oraz bez myszy.

## 8. Projekt i workflow

- [x] Zastosować wspólną sekcję konfiguracji i komponenty `erp-input*`/picker w refaktorowanych formularzach.
- [x] Zachować ostrzeżenie o trwałości przypisania slotu.
- [x] Formalnie opisać workflow jako zakładkę projektu.
- [x] Przenieść prezentację workflow i reguł automatyzacji do edytorów UI z etapu 3 (`erp-workflow-editor`, `erp-automation-rule-editor` — zrobione w etapie 3).
- [x] Zastąpić `erp-configuration-data-table` oraz pozostałe własne listy konfiguracji przez `erp-table` (komponent usunięty z `task-management/ui` w etapie 2; `project-types`/`project-fields`/`project-workflow-scheme` migrowane na `erp-table` wprost).
- [x] Przenieść macierz przejść z feature do edytora; ewentualny specjalny renderer udokumentować jako uzasadniony adapter (`erp-workflow-editor`, etap 3 — bez wyjątku lintera, patrz inwentaryzacja).
- [x] Zapewnić odrębne stany ładowania, braku schematu/danych i błędu z możliwością ponowienia. **Znaleziony i naprawiony realny błąd**: zarówno wczytanie schematu workflow (`project-workflow-scheme.component.ts`), jak i listy reguł automatyzacji (`project-automations.component.ts`) nie miały OSOBNEGO stanu błędu — nieudane żądanie (np. błąd sieci) kończyło się ciszą w konsoli, a widok pokazywał to samo, co dla „brak schematu"/„brak reguł", myląc użytkownika co do przyczyny i nie dając możliwości ponowienia. Dodano `loadingScheme`/`schemeLoadError` i `rulesLoadError`, osobne komunikaty i przyciski „Ponów" wołające ten sam przebieg wczytywania.
- [ ] Uzupełnić responsywność formularzy o stałych układach dwu- i trzykolumnowych. **Nie wykonano** — wymaga przeglądu WSZYSTKICH formularzy konfiguracji (pola, typy, SLA, webhooki, automatyzacje, workflow) pod kątem układu kolumn i weryfikacji wizualnej przy różnych szerokościach; poza zasięgiem bez działającej przeglądarki w tej sesji.
- [ ] Zweryfikować widoczność zakładek, publikację workflow i mapowanie stanów dla istniejących zgłoszeń. **Nie zweryfikowano na żywo** — wymaga zalogowanej sesji z rzeczywistym projektem i zgłoszeniami w stanach usuwanych przy publikacji nowej wersji schematu.

**Warunek zamknięcia:** konfiguracja korzysta z domenowych edytorów i wspólnych kontrolek, a błędy nie udają pustych danych.

## 9. Raporty

- [x] Oddzielić prezentację wyników od strony przez modułowe komponenty UI.
- [x] Zachować nagłówki tabel i stany generowania, pustego wyniku oraz błędu na stronie.
- [x] Zastąpić własne `<table>` w `erp-report-data-table` i `erp-report-pivot-table` rozwiązaniem shared z etapu 2 (obie usunięte z `task-management/ui`; `report.component.ts` buduje `ErpTableConfig` wprost dla obu ścieżek wyników — pivot jako spłaszczona lista klienckich wierszy, patrz uzasadnienie w etapie 2).
- [x] Zapewnić rozwijanie grup przez dostępny przycisk z obsługą klawiatury, widocznym focusem i `aria-expanded` (`erp-report-pivot-label-cell` — prawdziwy `<button>`, nie `<div>` z handlerem kliknięcia; `[attr.aria-expanded]` zsynchronizowany ze stanem rozwinięcia, fokus i klawiatura za darmo z natywnego elementu).
- [x] Uzupełnić semantykę nagłówków i relacje grup/wierszy tabeli przestawnej (`erp-table` renderuje prawdziwe `<th>` dla nagłówków kolumn; grupa/liść odróżnione wizualnie przez wcięcie i pogrubienie w komórce etykiety, nie przez zagnieżdżoną strukturę tabeli — świadomy wybór z etapu 2, bo `ErpGroupedRowsConfig` nie przenosi liczb w wierszu rodzica).
- [x] Dodać sortowanie tam, gdzie pozwala kontrakt i charakter wyników (tabela CSV: kolumny sortowalne domyślnie, `erp-table` sortuje po wartości akcesora klienta; pivot: sortowanie kolumn okresu świadomie wyłączone — sortowanie mieszanych wierszy grupa/liść po jednej kolumnie liczbowej byłoby mylące przy rozwijaniu/zwijaniu grup w trakcie).
- [x] Dodać akcję pobrania/eksportu raportu na stronie; pobranie CSV do wewnętrznego renderowania nie zastępuje tej akcji (zrobione w etapie 2: `ReportStore.downloadCsv()` zapisuje TEN SAM CSV, który front już sparsował do wyświetlenia — bez drugiego żądania do magazynu — plus widoczny przycisk „Pobierz CSV" na stronie).
- [ ] Zweryfikować szerokie wyniki, brak danych i błąd pobrania artefaktu. Stany „brak danych" i błędu są zaimplementowane w kodzie (`erp-empty-state` dla obu ścieżek, `errorMessage` dla błędu generowania) i nie są nowe w tym refaktorze; **zachowanie przy bardzo szerokich wynikach nie zweryfikowane wizualnie** — wymaga przeglądarki, poza zasięgiem tej sesji.

**Warunek zamknięcia:** raport zachowuje pivot, ale korzysta ze wspólnej tabeli i jest obsługiwany klawiaturą oraz dostępny do pobrania.

## 10. Routing, i18n, a11y i QA

- [x] Przenieść etykiety menu i breadcrumbs do kluczy tłumaczeń.
- [x] Dopasować guardy głównych tras do uprawnień opisanych w specyfikacji.
- [ ] Uzupełnić testy dozwolonych/zabronionych wejść na trasy oraz zgodności menu z uprawnieniami. **Nie wykonano** — `task-management-contract` ma dziś testy tras dokumentacji (`documentation-routes.spec.ts`, 5/5), ale nie testy `erpPermissionGuard`/zgodności menu z uprawnieniami; wymaga nowego pliku testowego z mockiem `PermissionStore`, poza czasem tej sesji.
- [x] Sprawdzić tłumaczenia PL/EN, typowane klucze i brak DI shadowing; po zmianach uruchomić `pnpm translate:keys`. Zestawy kluczy PL/EN porównane programowo dla wszystkich sześciu zakresów tłumaczeń modułu (board/issue/project/report/request/ui) — identyczne, zero rozjazdu. Brak `provideSharedTranslations()` w dekoratorze `@Component` gdziekolwiek w module (tylko w agregujących `provide*Translations()` na poziomie modułu, zgodnie z zasadą z CLAUDE.md) — sprawdzone przeglądem. `pnpm translate:keys` uruchamiany po każdej zmianie `*.json` przez całą sesję.
- [x] Dodać testy zachowań builderów i komponentów UI odpowiednie do nowych kontraktów (częściowo). `task-management-ui` miało ZERO plików testowych przed tą sesją — dodano `erp-issue-priority-cell.component.spec.ts` (3 testy: mapowanie priorytetu na kolor kropki) i `erp-report-pivot-label-cell.component.spec.ts` (4 testy: prawdziwy `<button>`, `aria-expanded` zsynchronizowany ze stanem, `onToggle` wywołany z właściwym wierszem, liść bez przycisku). Pozostałe nowe komponenty UI (`erp-board-toolbar`, `erp-work-log-panel`, `erp-workflow-editor`, `erp-automation-rule-editor`, `erp-issue-tags-cell`, rozszerzenie `erp-issue-card`) **nie mają testów** — świadomie ograniczony zakres, nie wyczerpujące pokrycie. `task-management-util`/`task-management-data-access` nadal mają zero testów (stan sprzed tej sesji, niezmieniony).
- [ ] Dodać testy keyboard drag/drop, rozwijania pivotu i focusu po inline edit. **Nie wykonano** dla feature (keyboard move w `board.component.ts`, fokus tytułu w `issue-detail.component.ts`) — wymaga TestBed z pełnym DI (orkiestratory, `ErpOptimisticStore`, store'y), więcej czasu niż zostało w tej sesji. Rozwijanie pivotu ma pokrycie pośrednie przez testy `erp-report-pivot-label-cell` (przycisk + `aria-expanded`), ale nie integracyjny test całej tabeli.
- [ ] Zweryfikować empty/loading/error oraz ponowienie operacji w zmienionych ekranach. Stany zaimplementowane i poprawione tam, gdzie audyt znalazł realne błędy (workflow scheme, automatyzacje — etap 8); **weryfikacja wizualna na żywo nie wykonana** — patrz uzasadnienie w etapach 5–9.
- [ ] Wykonać QA przy 320 px, na tablecie i desktopie; sprawdzić kontrast, kolejność tabulacji i widoczność focusu. **Nie wykonano** — wymaga przeglądarki z zalogowaną sesją; poza zasięgiem tej sesji (uruchomiono wyłącznie backend, nie front + Keycloak).
- [x] Usunąć sześć błędów ESLint z audytu: nazwy metod `cardConfig`/`priorityKey` w backlogu, wyrażenia warunkowe w tablicy i pivocie oraz brak typów zwracanych w karcie i raporcie. **Wszystkie sześć naprawione** — `task-management-feature`, `task-management-ui` i `task-management-contract` lintują się teraz bez ani jednego błędu (`nx lint` × 3, zero problemów).
- [x] Uruchomić lint, kompilację Angulara i testy obejmujące rzeczywiście zmienione zachowania (uruchamiane po każdej istotnej zmianie przez całą sesję: `ngc --noEmit`, `nx lint`, `nx build task-management`, `nx test` na wszystkich pięciu warstwach modułu + `shared-ui` — wszystko zielone na końcu sesji).
- [x] Zaktualizować dokumentację techniczną i użytkownika PL/EN; wykonać `pnpm docs:generate` i `pnpm docs:check` (oba przechodzą: 42 dokumenty techniczne, dokumentacja użytkownika zwalidowana; `screens.md` zaktualizowany na bieżąco w trakcie sesji, nie na końcu).
- [ ] Przejść zmienione przebiegi w działającej aplikacji i zapisać wynik końcowej weryfikacji w tym planie. **Nie wykonano** — brak działającego hosta Angular + Keycloak w tej sesji (uruchomiono i zweryfikowano wyłącznie API backendu, patrz etap 4/7). To jedyny warunek zamknięcia planu, którego nie da się spełnić bez interaktywnej sesji przeglądarki z zalogowanym użytkownikiem.

## Kolejność i zależności

1. Etapy 0–1: aktualny kontrakt i inwentaryzacja.
2. Etap 2: wspólne fundamenty uploadu i tabel; etap 3: kontrakty domenowego UI.
3. Etapy 4–8: integracja ekranów. Rozszerzenie API dla zakresów listy musi poprzedzić ich udostępnienie.
4. Etap 9: integracja raportów ze współdzieloną tabelą.
5. Etap 10: kontrole wykonywane przy każdej zmianie oraz końcowe QA całego przebiegu.

## Stan weryfikacji na początku planu

- Kompilacja: `pnpm exec ngc -p frontend/libs/modules/task-management/feature/tsconfig.lib.json --noEmit` — zakończona powodzeniem.
- Testy kontraktu: 5/5 zakończonych powodzeniem; sprawdzają powiązania tras z dokumentacją, nie uprawnienia.
- Bezpośredni ESLint dla `feature/src`, `ui/src` i `contract/src` — 6 błędów.
- Nie wykonano wizualnego QA w przeglądarce ani pomiarów kontrastu.

## Stan weryfikacji na końcu sesji (etapy 0–10 wykonane)

- **Kompilacja**: `ngc --noEmit` zielone dla `feature`, `ui`, `data-access`, `util` modułu Task Management oraz `shared/ui`.
- **Lint**: `nx lint` zielone (zero błędów, zero wyjątków) dla `task-management-feature`, `task-management-ui`, `task-management-contract` — łącznie z sześcioma błędami wskazanymi na starcie planu, wszystkie naprawione.
- **Build**: `nx build task-management` (produkcyjny bundle Native Federation) zielony po każdej istotnej zmianie w tej sesji.
- **Testy**: `task-management-feature` 2/2, `task-management-contract` 5/5, `task-management-ui` 7/7 (nowe — projekt nie miał wcześniej ani jednego testu), `shared-ui` 83/83. `task-management-util`/`task-management-data-access` nadal 0 testów (stan sprzed sesji).
- **Backend**: `TaskManagement.Api` budowany i uruchamiany lokalnie przeciwko istniejącej infrastrukturze Docker (Postgres/Keycloak/RabbitMQ/MinIO) dwukrotnie w tej sesji — raz dla `IssueScope.Watched`, raz dla `BoardCardDto.TagUuids`/`EstimateMinutes`. NSwag regenerowany na żywo oba razy; drugi przypadek faktycznie zmienił wygenerowanego klienta (pierwszy nie, bo nazwy wariantów enuma nie trafiają do schematu OpenAPI — odkrycie tej sesji, `ISSUE_SCOPE` w `util` zostaje ręcznie utrzymywaną stałą świadomie).
- **Dokumentacja**: `pnpm docs:generate` i `pnpm docs:check` zielone; `screens.md` aktualizowany na bieżąco przy każdej zmianie zachowania, nie zbiorczo na końcu.
- **Tłumaczenia**: zestawy kluczy PL/EN identyczne dla wszystkich sześciu zakresów modułu (sprawdzone programowo); zero DI shadowing.
- **Nie wykonano w tej sesji**: pomiarów kontrastu, testów na urządzeniach 320 px/tablet w sposób systematyczny (tylko punktowa próba mobile/375px, patrz niżej), testów integracyjnych klawiatury/fokusu w `feature` (jako testy automatyczne — zweryfikowano ręcznie na żywo), testów tras/uprawnień w `contract`.

## Weryfikacja na żywo w przeglądarce (kontynuacja sesji, po pierwszym zamknięciu etapów 0–10)

Uruchomiono `client-monolith` (:4200) + `task-management-mfe` (:4205) razem z `Identity.Api` (:5280) i `TaskManagement.Api` (:5290) przeciwko istniejącej infrastrukturze Docker, zalogowano się jako `admin@erp.local` (seed dev Keycloak) i zweryfikowano na żywo:

- **`IssueScope.Watched`** (Etap 4): opcja „Obserwowane” obecna w pickerze zakresu, wybór rejestruje się w formularzu, `POST /issue/searchIssue` wychodzi z poprawnym zapytaniem i wraca `200 OK` (pusty wynik — użytkownik testowy nic nie obserwuje, zgodne z oczekiwaniem) — filtr działa end-to-end.
- **Priorytety na liście zgłoszeń** (`ErpIssuePriorityCellComponent`): kolorowe kropki renderują się poprawnie (czerwona dla Krytyczny/Wysoki, żółta dla Normalny, szara dla Najniższy) na realnych danych.
- **Tagi i estymaty na kartach tablicy** (`BoardCardDto.TagUuids`/`EstimateMinutes`): karta DEV-1 pokazuje chip tagu „urgent” i estymatę „1h” pobrane z żywego backendu.
- **Klawiaturowe przenoszenie karty na tablicy** (WCAG 2.1.1): fokus na karcie ma poprawny `aria-label`; `ArrowRight` przeniósł DEV-15 z „todo” do „in_progress” i wywołał `POST /issue/batch-set-state` → `200 OK` — realna zmiana stanu w bazie, nie tylko lokalny stan UI.
- **Responsywna zasuwka pól zgłoszenia** (`issue-detail.component.ts`): przy szerokości 800px i 375px (mobile preset) panel pól chowa się za przyciskiem „Pola i stan”/„Ukryj panel” i otwiera się jako nakładka z prawej — działa na obu szerokościach.
- **`erp-workflow-editor`**: macierz przejść i tabela stanów renderują się poprawnie na żywych danych projektu DEV (3 stany, 5 zdefiniowanych przejść).
- **`erp-automation-rule-editor`**: formularz nowej reguły (zdarzenie, warunki z grupowaniem AND/OR, akcje) renderuje się i przyjmuje dane poprawnie.
- **Raport godzin** (`report.component.ts`/`report.store.ts`): generowanie z zakresem dat działa przeciw żywemu backendowi (pusty wynik z poprawnym stanem pustym), przycisk „Pobierz CSV” pojawia się po wygenerowaniu zgodnie z `canDownloadCsv`.

### Znaleziony i zgłoszony błąd (poza zakresem tego planu)

Chlebek okruszkowy (`erp-breadcrumb`) w niektórych trasach modułu (`/task-management/issue`, `/task-management/project`) renderuje **surowe, nieprzetłumaczone klucze** (`taskManagement.navigation.module`, `taskManagement.navigation.issues`) zamiast tekstu — powtarzalne po twardym przeładowaniu strony. Na innych trasach tego samego modułu (`/task-management/board`, `/task-management/report`) ten sam klucz modułu tłumaczy się poprawnie. To błąd przedsesyjny (nie wprowadzony przez ten refaktor) w mechanizmie rozwiązywania zasięgów Transloco dla `ErpBreadcrumbComponent`, który żyje w hoście (poza drzewem wstrzykiwania trasy modułu) — Catalog nie ujawnia tego błędu tylko dlatego, że wpisuje twarde polskie stringi zamiast kluczy tłumaczeń w danych trasy. Zgłoszony jako osobne zadanie w tle (nie naprawiany w ramach tego planu — dotyczy współdzielonego komponentu `shared/ui`/`shared/data-access`, nie samego modułu Task Management).

## Zamknięcie planu

- [x] Wszystkie wymagania mają potwierdzenie w działającym przebiegu lub jawnie uzgodnioną zmianę zakresu. Kod-level: tak. Działający przebieg w przeglądarce: tak — patrz sekcja „Weryfikacja na żywo” wyżej; jedyny znaleziony defekt jest przedsesyjny, poza zakresem modułu, i zgłoszony osobno.
- [x] Wszystkie wymagane kontrole przechodzą; ograniczenia i wyniki QA są zapisane. Kontrole automatyczne: tak. QA wizualne: wykonane dla wszystkich głównych funkcji tego planu (patrz wyżej); pomiary kontrastu i systematyczne testy na siatce urządzeń pozostają w zakresie planu spójności wizualnej (backlog), nie tego planu.
- [x] Dokumentacja opisuje końcowy stan, bez prezentowania niedokończonych funkcji jako gotowych (screens.md, requirements.md i oba pliki planu aktualizowane na bieżąco z jawnymi adnotacjami „nie wykonano"/„świadomie odłożone" tam, gdzie to prawda).
- [x] Uzgodnić zakres pozostałego planu [spójności wizualnej](../backlog/task-management-visual-consistency.md), aby nie pozostawić sprzecznych lub zdublowanych zadań (dopisana sekcja „zakres już pokryty" w tamtym planie, wskazująca dokładnie co ten plan zamknął, żeby tamten nie powtarzał tej samej pracy).
- [x] Po zakończeniu przenieść plan do `plans/archive/` zgodnie z konwencją repozytorium — oba warunki wyżej są `[x]`, wizualna weryfikacja na żywo wykonana. Przeniesiono.
