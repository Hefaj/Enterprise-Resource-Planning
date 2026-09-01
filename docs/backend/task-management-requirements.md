# Task Management — wymagania produktowe i funkcjonalne

**Stan dokumentu: 📐 specyfikacja docelowa.** Znaczniki przy wymaganiach mówią o stanie kodu:
✅ wdrożone, 🟡 częściowo, 📐 projekt. Legenda —
[`architecture.md` §1](./architecture.md#1-stan-wdrożenia).

Ten dokument jest **źródłem prawdy dla realizacji modułu**: co system ma robić, w jakiej
kolejności i po czym poznamy, że działa. Mechanika (jak liczy się `rank`, dlaczego sloty zamiast
EAV, jak wygląda predykat widoczności) mieszka w [`task-management.md`](./task-management.md)
i nie jest tu powtarzana — wymagania odsyłają do paragrafów tamtego dokumentu. Podział na strony
frontu → [`task-management-pages.md`](../frontend/task-management-pages.md).
Kolejność prac, checklisty i zmiany łamiące → [`PLAN-task-management.md`](../../PLAN-task-management.md).

---

## 0. Jak czytać ten dokument

### 0.1 Format wymagania

```
ID — Nazwa · Priorytet · Faza · Stan

Opis:            jedno zdanie, co system robi.
Warunek wstępny: uprawnienie / stan danych, bez którego wymaganie nie ma zastosowania.
AC1..ACn:        kryteria akceptacji, testowalne.
```

Priorytety: **Must** (bez tego moduł nie działa), **Should** (moduł działa, ale jest niewygodny),
**Could** (usprawnienie), **Won't** (świadomie odrzucone, patrz [§24](#24-decyzje-odrzucone)).

Prefiksy ID odpowiadają obszarom: `PRJ` projekt, `MEM` członkostwo, `ISS` zgłoszenie,
`TYP` typ zgłoszenia, `FLD` pola niestandardowe, `WF` automat stanów, `LNK` powiązania,
`CMT` komentarze, `HIS` historia, `ATT` załączniki, `TAG` tagi, `SRCH` wyszukiwanie,
`VIEW` zapisane widoki, `BRD` tablica, `SPR` sprint i backlog, `TIME` rejestracja czasu,
`REQ` zlecenia, `NTF` powiadomienia, `PERM` uprawnienia, `AUT` automatyzacje, `RPT` raporty,
`BULK` operacje masowe, `API` integracje, `NFR` wymagania niefunkcjonalne.

### 0.2 Cztery zasady, z których wynika reszta

1. **Konfiguracja jest daną, nie kodem.** Nowy typ zgłoszenia, nowy stan, nowe pole i nowa
   kolumna tablicy powstają w bazie, bez wdrożenia. Wyjątkiem są rzeczy, które zmieniają
   *znaczenie* dla raportów — kategoria stanu, typ danych pola — i te są zamkniętą listą.
2. **Zgłoszenie jest w dokładnie jednym stanie.** Na tym stoi tablica (karta leży w jednej
   kolumnie) i to jest powód, dla którego nie ma tu silnika obiegu z DMS-u
   ([`task-management.md` §5.4](./task-management.md#54-dlaczego-nie-silnik-z-dms-u)).
3. **Projekt jest granicą** widoczności, numeracji i konfiguracji. Nie ma bytu „organizacja"
   ani „workspace" ([§24.1](#241-organizacja--workspace)), nie ma bytu „dział"
   ([§24.2](#242-dział-jako-byt)).
4. **Wszystko, co nie jest o pracy do wykonania, należy do innego modułu.** Tożsamość i role —
   Identity. Doręczanie powiadomień — Notification. Pliki — `Erp.BuildingBlocks.Artifacts`.
   Raporty — `IReportDefinition`. Ten moduł nie dubluje żadnego z nich.

### 0.3 Słownik

| Pojęcie | W kodzie | W UI (PL) |
|---|---|---|
| Jednostka pracy | `Issue` | zgłoszenie |
| Kontener zgłoszeń, właściciel konfiguracji | `Project` | projekt |
| Typ zgłoszenia (błąd, zadanie, epik) | `IssueType` | typ |
| Stan w automacie | `WorkflowState` | stan |
| Kategoria stanu (`Todo`/`InProgress`/`Done`) | `WorkflowStateCategory` | kategoria |
| Tablica z kolumnami i kolejnością | `Board` | tablica |
| Iteracja | `Sprint` | sprint |
| Wpis rejestracji czasu | `WorkLog` | wpis czasu |
| Zlecenie działu zamawiającego | `Issue` w projekcie `Intake` | zlecenie |

**Zakaz nazw `Task`, `Job`, `WorkItem`** w `TaskManagement.Domain` — każde z tych słów jest już
zajęte gdzie indziej w systemie
([`task-management.md` §2](./task-management.md#2-nazewnictwo--issue-nigdy-task)).

---

## 1. Cel systemu

Moduł prowadzi **pracę wykonywaną w firmie**: co jest do zrobienia, kto to robi, w jakim jest
stanie i czy zdąży na termin. Wzorzec to YouTrack, ale świadomie okrojony — bierzemy z niego
model (konfigurowalne pola i stany per projekt, tablica jako widok na zgłoszenia, klucz czytelny),
a nie zakres produktu (helpdesk, baza wiedzy, whiteboardy, rozliczanie czasu pracownika).

### 1.1 Kto na tym pracuje

Trzy grupy odbiorców, z trzema rozłącznymi pytaniami — i to one, a nie lista funkcji YouTracka,
wyznaczają zakres:

| Kto | Pyta | Ekran |
|---|---|---|
| **Zespół wykonawczy** (dev, WMS, każdy dział prowadzący własną pracę) | „co robię dziś, co mnie blokuje" | tablica, lista zgłoszeń, karta |
| **Biznes zlecający** (osoby zgłaszające zadania i błędy) | „co z moim zleceniem" | lista zleceń, karta zlecenia |
| **Kierownictwo** (dyrektor IT) | „ile godzin który dział poświęcił na które zagadnienie" | raport rozliczenia godzin (`RPT-002`) |

Trzeci wiersz ma konsekwencję, którą łatwo przeoczyć: **raport nie liczy wstecz**. Rejestracja
czasu musi być na miejscu, zanim zespoły zaczną pracować, więc wchodzi w fazie 6 — razem
z narzędziami zespołu, a nie z ekranami kierownictwa ([§22](#22-zakres-mvp-i-fazy)).

### 1.2 Jak to się układa w projekty

Docelowy kształt: **dział = projekt**. Dział WMS zakłada projekt `WMS` (rodzaj `Delivery`), ma
w nim własne tagi, własne pola niestandardowe, własny automat stanów i własną tablicę; prowadzi
tam swoje zadania rozwojowe, błędy i pracę bieżącą. Dział zamawiający dostaje projekt rodzaju
`Intake`, w którym leżą jego zlecenia. To dlatego konfiguracja jest **daną per projekt**, a nie
globalnym ustawieniem systemu — dwa działy nigdy nie zgodzą się na jeden zestaw pól.

Wprost: „dział" **nie jest osobnym bytem w modelu** — jest projektem i jego zespołem
([§24.2](#242-dział-jako-byt)). Raport godzin „per dział" to w istocie raport per projekt
wykonawczy, z przypisaniem do zagadnienia po łańcuchu zleceń (`TIME-004`).

### 1.3 Dwa scenariusze końca-do-końca

- **Zespół wykonawczy** — dział prowadzi swoje zgłoszenia na tablicy, przeciąga karty między
  kolumnami, planuje iteracje i widzi, co blokuje co.
- **Zlecenie międzydziałowe** — dział niewykonawczy składa zlecenie, dział wykonawczy realizuje je
  swoimi zgłoszeniami we własnym cyklu życia, a zamawiający widzi postęp i **sam odbiera** wynik
  ([§15](#15-zlecenia-międzydziałowe-req)).

Drugi scenariusz jest tym, czego nie ma żaden inny moduł tego systemu, i to on uzasadnia, że moduł
nie jest kolejnym CRUD-em. On też jest jedynym miejscem, w którym godziny działu wykonawczego dają
się przypisać do zagadnienia zgłoszonego przez inny dział — czyli w którym powstaje odpowiedź
na pytanie kierownictwa.

---

## 2. Aktorzy i role (`PERM`, `MEM`)

Dwie **niezależne** osie, których nie wolno zlepić w jedną
([`identity-authz.md`](./identity-authz.md)):

- **uprawnienie funkcyjne w Identity** (`taskmgmt.issue.update`) — „czy w ogóle wolno ci robić
  tę rzecz w systemie";
- **rola w projekcie** (`project_member.role`) — „w których projektach".

| Aktor | Rola w projekcie | Typowe uprawnienia | Co robi |
|---|---|---|---|
| Obserwator | `Viewer` | `taskmgmt.issue.read` | czyta zgłoszenia projektu, komentuje, obserwuje |
| Wykonawca | `Contributor` | `+ issue.create`, `issue.update` | tworzy i prowadzi zgłoszenia, przestawia karty |
| Lider projektu | `Lead` | `+ issue.bulk`, `board.manage`, `project.manage` | konfiguruje projekt, tablice, członków, operacje masowe |
| Administrator konfiguracji | — | `taskmgmt.scheme.manage` | schematy stanów, typów i pól — wspólne dla wielu projektów |
| Zamawiający | `Contributor` w projekcie `Intake` | `issue.create` | składa zlecenie, odbiera realizację |
| **Kierownictwo** (dyrektor IT) | **brak — nie jest członkiem projektów** | `taskmgmt.report.read.all` | czyta **agregaty przekrojowe**: ile godzin który dział poświęcił na które zagadnienie |
| System | — | — | automatyzacje, eskalacje terminów, rebalans ranków |

Aktor „kierownictwo" jest w tej tabeli od początku, mimo że jego ekran wchodzi dopiero w fazie 7.
Powód jest praktyczny: to on wymusza, żeby **rejestracja czasu weszła przed raportami**
([§14](#14-rejestracja-czasu-time)) i żeby `work_log` dało się agregować **po łańcuchu zleceń**,
a nie tylko po projekcie ([§19](#19-raporty-i-dashboardy-rpt)). Zaprojektowanie raportu po fakcie
oznaczałoby brak danych za pierwsze pół roku.

**PERM-001 — Rola w projekcie nie jest kodem uprawnienia · Must · faza 0 · ✅**
Opis: liczba kodów uprawnień nie rośnie z liczbą projektów; rola jest atrybutem nadania.
AC1: dodanie projektu nie dodaje ani jednego kodu do `Permissions.cs` ani do `permission-codes.ts`.

**PERM-002 — Widoczność liczona po projekcie · Must · faza 0 · ✅**
Opis: użytkownik widzi zgłoszenia projektów, których jest członkiem, plus projektów publicznych.
AC1: predykat jest joinem w SQL, więc paginacja i sortowanie serwerowe działają bez materializacji.
AC2: zapytanie o zgłoszenie spoza zakresu zwraca `404`, nie `403` — istnienie klucza też jest informacją.

**PERM-003 — Zgłoszenie prywatne · Should · faza 5 · 📐**
Opis: `issue.is_restricted` zawęża widoczność do zgłaszającego, przypisanego, obserwujących i `Lead`.
AC1: zgłoszenie prywatne nie pojawia się w wynikach wyszukiwania osoby spoza tej listy.
AC2: nie pojawia się też na tablicy ani w raportach tej osoby.

**PERM-004 — Wgląd z powiązania · Should · faza 5 · 📐**
Opis: zamawiający widzi **nagłówek** (klucz, tytuł, stan, przypisany, termin) zgłoszenia
realizującego, bez członkostwa w projekcie wykonawczym.
AC1: opis, komentarze, załączniki i historia pozostają niedostępne.
AC2: nagłówek jest dostępny wyłącznie przez powiązanie typu `realizuje`, nie przez wyszukiwanie.

**PERM-005 — Dostęp przekrojowy do agregatów, nie do treści · Must · faza 7 · 📐**
Opis: `taskmgmt.report.read.all` daje prawo do **liczb** (godziny, liczba zgłoszeń, czasy
realizacji) ze wszystkich projektów, **bez** prawa do treści zgłoszeń tych projektów.
AC1: dyrektor IT widzi „dział WMS: 142 h na zagadnieniu X" nie będąc członkiem projektu WMS.
AC2: kliknięcie w liczbę **nie otwiera** listy zgłoszeń, do których nie ma dostępu — rozwinięcie
kończy się na poziomie, na którym agregat przestaje być anonimowy.
AC3: to uprawnienie **nie jest trzecim wyjątkiem w predykacie widoczności zgłoszeń**
([`task-management.md` §10.1](./task-management.md#101-widoczność-liczona-po-projekcie)) —
działa wyłącznie w zapytaniach raportowych, które nigdy nie zwracają tytułu ani opisu.
Uzasadnienie AC3: dopisanie `OR ma_uprawnienie_raportowe` do predykatu listy jest jednolinijkową
zmianą, która po cichu otwiera cudze zgłoszenia prywatne. Rozdział idzie po **zapytaniu**,
nie po fladze.

**MEM-001 — Zarządzanie członkami projektu · Must · faza 0 · ✅**
Opis: `Lead` dodaje i usuwa członków, nadając rolę.
AC1: usunięcie ostatniego `Lead` jest odrzucane walidacją — projektu bez lidera nie ma kto skonfigurować.
AC2: zmiana roli członka jest zapisywana w historii projektu.

**MEM-002 — Członkostwo grupowe · Could · później · 📐**
Opis: członkiem projektu może być grupa z Identity, nie tylko osoba.
Uzasadnienie odłożenia: dopóki Identity nie ma jednostek organizacyjnych, grupa jest listą osób —
ten sam efekt, większy koszt w predykacie widoczności.

---

## 3. Projekty (`PRJ`)

**PRJ-001 — Utworzenie projektu · Must · faza 0 · ✅**
Warunek wstępny: `taskmgmt.project.manage`.
Opis: projekt ma kod (prefiks klucza), nazwę, rodzaj (`Delivery`/`Intake`), schemat stanów,
opcjonalny schemat pól i flagę publiczności.
AC1: kod jest unikalny, wielkimi literami, 2–8 znaków, tylko `[A-Z0-9]`.
AC2: utworzenie projektu zakłada licznik klucza z `next_number = 1` w tej samej transakcji.
AC3: twórca zostaje `Lead`.

**PRJ-002 — Rodzaj projektu · Must · faza 0 · ✅**
Opis: `Delivery` (projekt wykonawczy) i `Intake` (rejestr zleceń) to **jeden agregat z atrybutem**,
nie dwa typy w kodzie; różnią się domyślnym schematem stanów i domyślnymi uprawnieniami.
AC1: zmiana rodzaju istniejącego projektu jest niemożliwa (pole ustawiane przy tworzeniu).

**PRJ-003 — Zmiana prefiksu · Should · faza 6 · 📐**
Opis: zmiana kodu projektu nie przenumerowuje istniejących zgłoszeń.
AC1: istniejące klucze zostają bez zmian; nowe zgłoszenia dostają nowy prefiks.
AC2: licznik nie jest resetowany.

**PRJ-004 — Archiwizacja projektu · Should · faza 6 · 📐**
Opis: projekt archiwalny jest tylko do odczytu; znika z domyślnych list i z wyboru przy tworzeniu
zgłoszenia, ale linki do jego zgłoszeń nadal działają.
AC1: próba utworzenia zgłoszenia w archiwalnym projekcie jest odrzucana błędem
`taskmgmt.project_archived`.
AC2: usunięcia projektu **nie ma** ([§24.6](#246-usuwanie-projektów-i-zgłoszeń)).

**PRJ-005 — Konfiguracja projektu w UI · Must · faza 3 · 🟡**
Opis: karta projektu zbiera w zakładkach: pola, stany, typy, tablice, członków, SLA.
AC1: zakładka wchodzi do UI dopiero z fazą, która ją wypełnia — pusta zakładka jest zaślepką.
AC2: zmiana schematu pól projektu, w którym są już zgłoszenia z wartościami, wymaga potwierdzenia
i uruchamia walidację ([§6](#6-pola-niestandardowe-fld)).

**PRJ-006 — SLA projektu · Should · faza 5 · 📐**
Opis: polityka czasu reakcji i czasu realizacji, liczona po kalendarzu roboczym, per typ zgłoszenia
i priorytet.
AC1: kalendarz roboczy (dni wolne, godziny) jest konfiguracją projektu, nie stałą w kodzie.
AC2: czas reakcji liczy się od utworzenia do pierwszego wejścia w kategorię `InProgress`.

---

## 4. Zgłoszenia (`ISS`)

**ISS-001 — Utworzenie zgłoszenia · Must · faza 0 · ✅**
Warunek wstępny: `taskmgmt.issue.create` + rola `Contributor`/`Lead` w projekcie.
Pola wymagane: projekt, tytuł, typ. Opcjonalne: opis, przypisany, priorytet, termin, tagi, rodzic,
pola niestandardowe.
AC1: Given uprawnienie i wypełnione pola wymagane, When zatwierdzam, Then zgłoszenie powstaje
w stanie początkowym schematu projektu.
AC2: Given pusty tytuł, When zatwierdzam, Then walidacja odrzuca żądanie z `ProblemDetails`
i zgłoszenie nie powstaje.
AC3: zgłoszenie dostaje klucz `KOD-NNN` unikalny globalnie, nadany w **tej samej transakcji**
([`task-management.md` §4](./task-management.md#4-klucz-czytelny-dev-123)).
AC4: zgłaszającym jest wywołujący; nie da się go podać w komendzie.

**ISS-002 — Klucz czytelny · Must · faza 0 · ✅**
AC1: dwie instancje serwisu tworzące zgłoszenia w tym samym projekcie równolegle nie nadają
zduplikowanego numeru ani nie zwracają błędu unikalności.
AC2: odrzucenie transakcji nie zużywa numeru (brak dziur w numeracji).
AC3: operacja masowa bierze pulę numerów jednym `UPDATE`, jeden chunk = jeden przeskok licznika.

**ISS-003 — Edycja pól zgłoszenia · Must · fazy 0–3 · ✅**
Opis: tytuł, opis, priorytet, przypisany, termin, typ, tagi i pola niestandardowe zmieniają się
**osobnymi komendami** wg konwencji `IssueSet…` ([`endpoint-naming.md`](./endpoint-naming.md)),
nie jednym `PATCH` ([§24.4](#244-crud-owe-api-put--patch)).
AC1: każda zmiana dopisuje wpis do historii w tej samej transakcji.
AC2: `updated_at` zmienia się wyłącznie przy zmianie treści zgłoszenia, nie przy zmianie
kolejności karty na tablicy.

**ISS-004 — Opis w formacie bogatym · Must · faza 1 · ✅**
Opis: opis jest HTML-em czyszczonym przy zapisie (`IRichTextSanitizer`).
AC1: znaczniki spoza białej listy są usuwane po stronie serwera, nie tylko w edytorze.
AC2: treść nie zmienia się po ponownym zapisie (sanityzacja jest idempotentna).

**ISS-005 — Obrazy osadzone w opisie · Must · faza 4 · 📐**
Opis: obraz trafia do opisu **trzema drogami — wklejeniem ze schowka (`Ctrl+V`), przeciągnięciem
pliku na edytor i wyborem z dysku** — i w każdej z nich staje się załącznikiem zgłoszenia,
a w treści siedzi jako referencja rozwiązywana do `blob:` przy wyświetlaniu.
Warunek wstępny: uprawnienie do edycji zgłoszenia.
AC1: Given zrzut ekranu w schowku, When wciskam `Ctrl+V` w edytorze opisu, Then obraz wgrywa się
od razu (bilet → `PUT` → rejestracja), a w treści pojawia się miniatura — **bez okna wyboru pliku
i bez osobnego przycisku „zapisz"**.
AC2: w trakcie transferu w treści stoi element zastępczy z postępem; niepowodzenie zostawia
komunikat w miejscu obrazu, nie pustkę.
AC3: zapisany HTML nie zawiera adresu z tokenem ani `data:` z bajtami obrazu — wyłącznie
referencję do załącznika.
AC4: podgląd i edytor rozwiązują referencję identycznie; po odświeżeniu strony obraz nadal jest.
AC5: usunięcie zgłoszenia usuwa osadzone obrazy razem z nim.
AC6: obraz wklejony i **usunięty z treści przed zapisem** nie zostawia osieroconego pliku —
sprząta go lifecycle prefiksu postojowego ([`media-storage.md`](./media-storage.md)), nie worker
liczący referencje.

> **To zmiana w `@erp/shared/ui`, nie w module.** `erp-rich-text` ma dziś w builderze jawną
> decyzję „`TuiEditorTool.Img` celowo nie ma w żadnym zestawie", a obsługi wklejania nie ma
> w ogóle. Wklejanie obrazów musi wejść jako **zdolność komponentu współdzielonego** z portem
> na wgrywanie (moduł podaje własną implementację biletu), inaczej DMS i Catalog dostaną za
> chwilę drugą i trzecią kopię tego samego kodu.

**ISS-006 — Priorytet · Must · faza 0 · ✅**
Opis: zamknięta lista (`Critical`/`High`/`Normal`/`Low`) — **nie** pole niestandardowe, bo
sortowanie po priorytecie jest domyślnym porządkiem list i tablic.
AC1: kolejność sortowania wynika z porządku wyliczenia, nie z nazwy.

**ISS-007 — Rozwiązanie (`resolution`) · Must · faza 6 · 📐**
Opis: przejście do stanu kategorii `Done` wymaga rozwiązania ze słownika projektu
(`Zrobione`/`Duplikat`/`Nie zrobimy`/`Nie da się odtworzyć`).
AC1: Given przejście do `Done` bez rozwiązania, When zatwierdzam, Then żądanie jest odrzucane
(mechanizmem `required_fields` przejścia, [§7](#7-automat-stanów-wf)).
AC2: powrót ze stanu `Done` czyści rozwiązanie i zapisuje to w historii.
Uzasadnienie: brak rozwiązania to najczęstsze źródło śmieci w raportach zamknięć.

**ISS-008 — Estymata · Should · faza 6 · 📐**
Opis: `estimate_minutes` na zgłoszeniu, prezentowana jako `2d 4h`; suma estymat dzieci pokazywana
obok estymaty rodzica, **nie zamiast niej**.
AC1: estymata rodzica i suma dzieci to dwie osobne liczby — nadpisywanie jednej drugą niszczy
planowanie.

**ISS-009 — Obserwujący · Must · faza 5 · 📐**
Opis: `issue_watcher(issue_uuid, user_uuid)`; obserwującym zostaje się automatycznie po
komentarzu, przypisaniu lub wzmiance, i można zrezygnować.
AC1: rezygnacja jest trwała — kolejny komentarz nie dopisuje z powrotem.
AC2: lista obserwujących jest jedynym źródłem odbiorców powiadomień o zgłoszeniu
([§16](#16-powiadomienia-ntf)).

**ISS-010 — Przeniesienie do innego projektu · Should · faza 6 · 📐**
AC1: zgłoszenie dostaje nowy klucz, stary ląduje w `previous_keys`.
AC2: stary klucz nadal otwiera kartę (przekierowanie), inaczej linki w mailach umierają.
AC3: przeniesienie rodzica przenosi dzieci; wykonuje to operacja masowa z widocznym postępem.
AC4: pola niestandardowe bez odpowiednika w schemacie docelowym są **pokazywane do decyzji przed
przeniesieniem**, nie kasowane po cichu.

**ISS-011 — Karta zgłoszenia pod kluczem · Must · faza 0 · ✅**
Opis: trasa `/task-management/issue/:key` — po kluczu czytelnym, nie po UUID.
AC1: wejście na poprzedni klucz przekierowuje na bieżący.

**ISS-012 — Duplikat · Could · później · 📐**
Opis: duplikat oznacza się powiązaniem `duplikuje` i rozwiązaniem `Duplikat`. Scalania treści
(przenoszenia komentarzy) **nie ma** — [§24.7](#247-scalanie-zgłoszeń).

---

## 5. Typy zgłoszeń (`TYP`)

**TYP-001 — Typ jako dana, nie enum · Must · faza 4 · 📐**
Opis: `issue_type(uuid, scheme_uuid, code, name, name_key, icon, category, order_no)`;
projekt wskazuje **schemat typów**, tak samo jak wskazuje schemat stanów i schemat pól.
AC1: dodanie typu `Incydent` czy `Zlecenie serwisowe` nie wymaga wdrożenia kodu.
AC2: `type.category ∈ { Epic | Standard | Subtask }` — kategoria, nie nazwa, decyduje o tym,
co wolno w hierarchii ([§8](#8-hierarchia-i-powiązania-lnk)) i jak liczą raporty.

**TYP-002 — Zestaw startowy · Must · faza 4 · 📐**
Opis: seed daje schemat systemowy: `Epik` (Epic), `Funkcjonalność`, `Zadanie`, `Błąd` (Standard),
`Podzadanie` (Subtask).
AC1: schemat systemowy jest oznaczony `is_system`; nie da się go usunąć ani zmienić kategorii
jego typów.

**TYP-003 — Typ steruje konfiguracją · Should · faza 4 · 📐**
Opis: typ może zawężać zestaw widocznych pól niestandardowych i wskazywać własny schemat stanów
w obrębie projektu (błąd i epik rzadko mają ten sam cykl życia).
AC1: brak wskazania = dziedziczenie po projekcie; to stan domyślny, nie brak konfiguracji.
AC2: zmiana typu zgłoszenia, gdy nowy typ ma inny schemat stanów, wymaga wskazania stanu
docelowego — ta sama mechanika, co migracja przy publikacji schematu (`WF-006`).

**TYP-004 — Usunięcie typu · Should · faza 4 · 📐**
AC1: usunięcie typu użytego na zgłoszeniach jest odrzucane; użytkownik dostaje liczbę zgłoszeń
i link do ich listy.

---

## 6. Pola niestandardowe (`FLD`)

Mechanika (jsonb jako źródło prawdy + sloty typowane dla SQL) →
[`task-management.md` §6](./task-management.md#6-pola-niestandardowe). Odrzucenie EAV →
[§24.3](#243-eav-issuefielddefinition--issuefieldvalue).

**FLD-001 — Definicja pola w schemacie · Must · faza 3 · ✅**
Opis: pole ma kod, nazwę, typ danych (`Number`/`Text`/`Date`/`User`/`Enum`/`MultiEnum`/`Bool`),
wymagalność, wartość domyślną i — jeśli sortowalne lub filtrowalne — slot.
AC1: mapowanie na slot jest **niezmienne po pierwszym użyciu**; UI ostrzega o tym przed zapisem.
AC2: usunięcie pola z wartościami na zgłoszeniach jest odrzucane.

**FLD-002 — Nazwa pola jako tekst, nie tylko klucz tłumaczenia · Must · faza 4 · 🟡**
Opis: pole zakładane z UI podaje **nazwę** (zwykły tekst) i opcjonalnie klucz tłumaczenia — ten
drugi tylko dla pól systemowych z seeda.
AC1: pole założone bez klucza wyświetla swoją nazwę, nigdy surowy klucz.
Uzasadnienie: dzisiejszy stan (tylko `nameKey`) pokazuje użytkownikowi nierozwiązany klucz —
znany chropowaty brzeg z
[`task-management-pages.md` §4.2](../frontend/task-management-pages.md#42-karta-projektu--task-managementprojectuuid).

**FLD-003 — Profil pól jako jedno źródło prawdy · Must · faza 3 · ✅**
Opis: `getProjectFieldProfile` zwraca kolumny, filtry, słowniki i whitelistę sortowania; front
buduje z niego tabelę, filtr i sekcję pól na karcie.
AC1: sortowanie po kolumnie spoza profilu jest odrzucane przez backend.
AC2: zmiana projektu na liście **resetuje sortowanie i filtry projekto-specyficzne**.

**FLD-004 — Walidacja wartości · Must · faza 3 · ✅**
AC1: wartość niezgodna z typem lub spoza słownika jest odrzucana przy zapisie, nie przy odczycie.
AC2: pole wymagane bez wartości blokuje wyłącznie te przejścia, które wymieniają je
w `required_fields` — nie każdy zapis zgłoszenia.

**FLD-005 — Wyczerpanie slotów · Should · faza 4 · 📐**
AC1: próba oznaczenia pola jako sortowalne przy braku wolnego slotu danego typu kończy się
komunikatem mówiącym **ile slotów jest zajętych i przez co**, a nie ogólnym błędem.
AC2: pole niesortowalne i niefiltrowalne nie zajmuje slotu — takich można mieć dowolnie wiele.

**FLD-006 — Wersje i komponenty jako pola słownikowe · Should · faza 4 · 📐**
Opis: „Fix Version" i „Component" nie są osobnymi bytami — to pola typu `Enum` ze słownikiem
zarządzanym na karcie projektu ([§24.5](#245-versions-i-components-jako-osobne-agregaty)).

---

## 7. Automat stanów (`WF`)

**WF-001 — Schemat stanów jako dana · Must · faza 1 · ✅**
Opis: `workflow_scheme` + `workflow_state` + `workflow_transition`; projekt wskazuje schemat.
AC1: nowy zestaw stanów nie wymaga wdrożenia kodu.
AC2: `state.category ∈ { Todo | InProgress | Done }` — raporty i tablica liczą po kategorii,
nie po nazwie.

**WF-002 — Przejście nieopisane nie istnieje · Must · faza 1 · ✅**
AC1: `issueSetState` na przejście spoza schematu zwraca `taskmgmt.transition_not_allowed`
i nie zapisuje nic.

**WF-003 — Reguły na przejściu · Must · faza 1 · 🟡**
Opis: przejście niesie `required_permission`, `required_fields` i `guard` (warunek na polach,
w tym samym wąskim języku, co krawędzie gateway w DMS).
AC1: brak uprawnienia → `403`; brak pola wymaganego → `400` z listą kodów pól.
AC2: `guard` nie wykonuje wyrażeń ogólnego przeznaczenia — porównania, `and`/`or`, ścieżka, literał.

**WF-004 — Modal pól wymaganych · Must · faza 4 · 📐**
Opis: przejście z `required_fields` otwiera modal przed wykonaniem; na tablicy karta wisi
„w toku" do zamknięcia modala.
AC1: anulowanie modala cofa ruch karty do stanu sprzed przeciągnięcia.

**WF-005 — Bieżący schemat, bez snapshotu · Must · faza 1 · ✅**
Opis: zgłoszenia zawsze czytają bieżącą wersję schematu (odwrotnie niż instancja obiegu w DMS).
Uzasadnienie: tablica pokazuje setki kart w kolumnach wyprowadzonych ze stanów — karty na starej
wersji schematu wymagałyby kolumn, których w konfiguracji już nie ma.

**WF-006 — Publikacja schematu i migracja stanów · Must · faza 7 · 📐**
AC1: usunięcie stanu wymaga wskazania stanu docelowego dla zgłoszeń, które w nim siedzą.
AC2: publikacja bez pełnego mapowania jest odrzucana walidacją, nie kończy się osieroceniem.
AC3: migracja idzie przez `job`/`job_item` z widocznym postępem i sukcesem częściowym.

**WF-007 — Edytor schematu w UI · Should · faza 7 · 📐**
Opis: dwie listy (stany, przejścia) + macierz „z → do". **Nie canvas grafu** — automat jest
sekwencyjny.
AC1: macierz pokazuje uprawnienie i pola wymagane na przecięciu, bez wchodzenia w szczegóły.

---

## 8. Hierarchia i powiązania (`LNK`)

**LNK-001 — Hierarchia jednorodzicielska · Must · faza 4 · ✅**
Opis: `issue.parent_uuid`, drzewo epik → zadanie → podzadanie.
AC1: zgłoszenie ma najwyżej jednego rodzica.
AC2: kategoria typu ogranicza zagnieżdżenie: `Subtask` nie może być rodzicem, `Epic` nie może być
dzieckiem.

**LNK-002 — Powiązania jako graf · Must · faza 4 · ✅**
Opis: `issue_link(source, target, type)`; typy: `blokuje`/`blokowane przez`, `duplikuje`,
`dotyczy`, `realizuje`.
AC1: typ ma stronę odwrotną i UI pokazuje ją po drugiej stronie automatycznie — nie zapisujemy
dwóch wierszy.
AC2: powiązanie może przechodzić granicę projektu.

**LNK-003 — Brak cykli · Must · faza 4 · ✅**
Opis: drzewo i `blokuje` muszą być acykliczne; sprawdzenie to `IBatchRule` liczona rekurencyjnym
CTE w bazie, nie wczytaniem grafu do pamięci.
AC1: reguła działa także w pre-checku operacji masowej.
AC2: komunikat wskazuje **ścieżkę cyklu** kluczami zgłoszeń, nie sam fakt cyklu.

**LNK-004 — Zamknięcie rodzica z otwartymi dziećmi · Should · faza 4 · 📐**
AC1: domyślnie ostrzeżenie z możliwością potwierdzenia; twarda blokada jest opcją konfiguracji
projektu.
Uzasadnienie: twarda blokada jest obchodzona kasowaniem podzadań.

**LNK-005 — Zgłoszenie zablokowane · Should · faza 4 · 📐**
AC1: zmiana stanu zgłoszenia blokowanego przez otwarte zgłoszenie wymaga potwierdzenia — to
ostrzeżenie walidacyjne, nie `guard`.

**LNK-006 — Tryb drzewa na liście · Should · faza 4 · 📐**
AC1: lista zgłoszeń przełącza się w drzewo bez zmiany zestawu kolumn i bez utraty filtru.
AC2: dzieci spoza bieżącego filtru są pokazywane wyszarzone, a nie ukrywane — inaczej drzewo kłamie.

---

## 9. Komentarze, historia, załączniki (`CMT`, `HIS`, `ATT`)

**CMT-001 — Komentarz z wątkiem jednopoziomowym · Must · faza 1 · ✅**
AC1: odpowiedź na odpowiedź trafia do tego samego poziomu — reguła domeny, nie uproszczenie widoku.
AC2: po zapisie front **nie dopisuje komentarza lokalnie**; wątek wraca zdarzeniem realtime.

**CMT-002 — Edycja zachowuje oryginał · Must · faza 1 · ✅**
AC1: poprzednia treść jest przechowywana i dostępna dla `Lead`; UI oznacza komentarz jako edytowany.

**CMT-003 — Usunięcie miękkie · Must · faza 1 · ✅**
AC1: usunięty komentarz zostawia ślad („komentarz usunięty"), nie znika z wątku bez śladu.

**CMT-004 — Wzmianki `@` · Must · faza 5 · 📐**
AC1: wzmianka dopisuje osobę do obserwujących i wywołuje powiadomienie.
AC2: podpowiadanie osób idzie przez port `ERP_USER_DIRECTORY`
([`user-directory.md`](../frontend/user-directory.md)), nie przez lokalny endpoint modułu.

**CMT-005 — Reakcje · Could · później · 📐**

**CMT-006 — Obrazy i pliki w komentarzu · Must · faza 4 · 📐**
Opis: komentarz przyjmuje obrazy i pliki tymi samymi trzema drogami, co opis (`ISS-005`):
schowek, przeciągnięcie, wybór z dysku.
AC1: Given zrzut ekranu w schowku, When wklejam go do pola komentarza, Then obraz wgrywa się
od razu i pojawia się w treści komentarza.
AC2: załącznik dodany w komentarzu należy do **zgłoszenia**, nie do komentarza — pojawia się
na liście załączników zgłoszenia i przeżywa miękkie usunięcie komentarza.
AC3: komentarz niezapisany, porzucony razem z wgranym obrazem, nie zostawia osieroconego pliku
(ten sam mechanizm, co `ISS-005` AC6).
Uzasadnienie AC2: „wrzuć zrzut ekranu do komentarza" to najczęstszy sposób dodawania dowodu
w zgłoszeniu błędu. Gdyby plik należał do komentarza, usunięcie komentarza kasowałoby dowód,
a lista załączników zgłoszenia kłamałaby o tym, co do niego dopięto.

**HIS-001 — Historia pole po polu · Must · faza 1 · ✅**
Opis: `issue_activity` append-only, dopisywana **jawnie w komendzie**, w tej samej transakcji
co zmiana.
AC1: wpis niesie rodzaj, kod pola, starą i nową wartość oraz korelację.
AC2: historii nie zmienia ani nie usuwa żaden endpoint — również administratorowi.
AC3: zdanie w UI składa szablon z klucza tłumaczenia, nie backend.

**HIS-002 — Historia zna pola niestandardowe · Must · faza 3 · 🟡**
AC1: zmiana pola własnego pojawia się w historii pod swoją nazwą, nie jako „zmieniono `text_2`".

**ATT-001 — Załączniki zgłoszenia · Must · faza 1 · ✅**
AC1: plik wgrywa się od razu po wybraniu; bajty idą prosto do magazynu, nie przez mikroserwis
(bilet → `PUT` → rejestracja jedną komendą).
AC2: podgląd przez `blob:`, nigdy adres endpointu w `src`.
AC3: usunięcie zgłoszenia usuwa pliki w tej samej transakcji
([`media-storage.md`](./media-storage.md)).

**ATT-002 — Usunięcie pojedynczego załącznika · Should · faza 6 · 📐**
Uzasadnienie zmiany wobec dzisiejszego stanu: przy zgłoszeniach żyjących miesiącami omyłkowo
wgrany plik musi dać się usunąć. Kasowanie wchodzi razem z prefiksem postojowym i lifecycle,
nie jako gołe `DELETE` na kluczu MinIO.

---

## 10. Tagi (`TAG`)

**TAG-001 — Tag jako byt, nie pole niestandardowe · Must · faza 6 · 📐**
Opis: `tag(uuid, project_uuid null, name, color)` + `issue_tag(issue_uuid, tag_uuid)`;
`project_uuid = null` znaczy tag globalny.
AC1: filtrowanie po tagu jest joinem, nie przeszukiwaniem jsonb.
AC2: tag jest wielowartościowy z natury — pole `MultiEnum` na jednym slocie tego nie udźwignie.

**TAG-002 — Zakładanie tagu w locie · Should · faza 6 · 📐**
AC1: uprawnienie `taskmgmt.tag.manage` decyduje, kto może założyć nowy tag; bez niego użytkownik
wybiera tylko z istniejących.
Uzasadnienie: swobodne zakładanie kończy się listą z `backend`, `back-end` i `Backend`.

**TAG-003 — Scalanie i zmiana nazwy tagu · Could · faza 7 · 📐**

---

## 11. Wyszukiwanie i filtrowanie (`SRCH`, `VIEW`)

**SRCH-001 — Filtr strukturalny · Must · fazy 0–3 · ✅**
Opis: `searchIssue` przyjmuje **obiekt filtra** (projekt, zakres, stan, typ, priorytet, przypisany,
tagi, termin, pola własne), paginację i sortowanie z whitelisty.
AC1: sortowanie po kolumnie spoza whitelisty projektu jest odrzucane.
AC2: filtr i sortowanie są w URL-u strony — link do widoku ma działać po wklejeniu.

**SRCH-002 — Zakresy · Must · faza 0 · ✅**
Opis: `Moje` / `Zgłoszone przeze mnie` / `Obserwowane` / `Mojego zespołu` / `Wszystkie dostępne`
jako parametr, nie osobne strony.

**SRCH-003 — Wyszukiwanie pełnotekstowe · Should · faza 6 · 📐**
Opis: po tytule, opisie i komentarzach, po indeksie GIN Postgresa.
AC1: wynik jest zawężony predykatem widoczności **w tym samym zapytaniu**, nie odfiltrowany po fakcie.
AC2: fraza w cudzysłowie działa jako fraza.

**SRCH-004 — Skok do klucza · Must · faza 6 · 📐**
AC1: wpisanie `DEV-412` w wyszukiwarce otwiera kartę zamiast pokazywać listę wyników.

**SRCH-005 — Język zapytań · Could · faza 8 · 📐**
Opis: wąski DSL (`project: ERP state: Open assignee: me`) **parsowany na backendzie do tego samego
obiektu filtra**, co formularz.
AC1: parser nie generuje SQL-a; nieznane pole kończy się błędem z pozycją w tekście.
AC2: DSL i formularz dają identyczny wynik dla równoważnego zapytania.
Uzasadnienie odłożenia: [§24.8](#248-dsl-w-mvp).

**VIEW-001 — Zapisany widok · Should · faza 7 · 📐**
Opis: nazwany zestaw (filtr + sortowanie + kolumny + tryb listy/drzewa), prywatny lub
udostępniony projektowi.
AC1: widok udostępniony jest dla innych tylko do odczytu; skopiowanie „do siebie" to jedno kliknięcie.
AC2: widok wskazujący na usunięte pole otwiera się z pominięciem tego warunku i komunikatem,
zamiast rzucać błędem.

**VIEW-002 — Widok domyślny projektu · Could · faza 7 · 📐**

---

## 12. Tablice (`BRD`)

**BRD-001 — Tablica jest widokiem na zgłoszenia · Must · faza 2 · ✅**
Opis: tablica nie ma własnych kopii zgłoszeń; kolumna karty **wynika ze stanu zgłoszenia**
i mapowania kolumn, i nie jest przechowywana.
AC1: zmiana stanu spoza tablicy przesuwa kartę do właściwej kolumny bez żadnej synchronizacji.

**BRD-002 — Ręczna kolejność kart · Must · faza 2 · ✅**
Opis: `board_card.rank` jako łańcuch porządkowany leksykograficznie; komenda przyjmuje
**sąsiadów**, rank liczy serwer w transakcji.
AC1: przeciągnięcie karty to jeden `UPDATE` jednego wiersza.
AC2: dwie osoby wstawiające kartę w to samo miejsce dostają identyczny rank i **nie jest to błąd** —
porządek rozstrzyga `(rank, issue_uuid)`.
AC3: rozgłoszenie realtime niesie uuid przestawionej karty i sąsiadów, nie całej tablicy.

**BRD-003 — Optymistyczne przestawienie z cofnięciem · Must · faza 2 · ✅**
AC1: karta ląduje w nowym miejscu natychmiast; `409` cofa ruch i pokazuje toast — przez
`ErpOptimisticStore` (`docs/frontend/optimistic-updates.md`), nie ręczny lokalny sygnał.
AC2: karta nie przeskakuje pod kursorem, gdy w międzyczasie dojdzie echo własnej zmiany —
nakładka pozycji żyje poza cache'm kart i wygrywa z danymi z serwera aż do własnego zdjęcia, więc
rozpoznawanie echa po stronie odbioru nie jest potrzebne (`docs/frontend/optimistic-updates.md` §9).

**BRD-004 — Wygaszanie niedozwolonych kolumn · Must · faza 2 · ✅**
AC1: kolumny, do których przejście jest niedozwolone, są wygaszane **w chwili chwycenia karty**,
na podstawie przejść ze schematu.

**BRD-005 — Rebalans ranków · Must · faza 2 · ✅**
AC1: usługa tła jest oznaczona `[ClusterSafe]` i bierze dzierżawę — bez tego nie przechodzi
`BackgroundServiceTests`.
AC2: rebalans rozgłasza `BulkChanged`, nie listę kilkuset uuid-ów.

**BRD-006 — Swimlane'y · Should · faza 6 · 📐**
Opis: grupowanie wierszy po przypisanym, epiku, priorytecie lub polu własnym typu `Enum`.
AC1: kolejność kart jest zachowywana **w obrębie swimlane'u**, bez drugiego mechanizmu ranku.
AC2: karta bez wartości grupującej trafia do jawnego wiersza „Bez przypisania", nie znika.

**BRD-007 — Limity WIP · Could · faza 6 · 📐**
AC1: przekroczenie limitu kolumny jest sygnalizowane wizualnie i **nie blokuje** upuszczenia.

**BRD-008 — Konfiguracja tablicy · Must · faza 2 · ✅**
Opis: filtr źródłowy (projekt/y + warunek), kolumny mapowane na stany, tryb (`Kanban`/`Scrum`).
AC1: stan nieprzypisany do żadnej kolumny nie powoduje zniknięcia karty — trafia ona do kolumny
domyślnej, a konfiguracja jest oznaczona jako niepełna.

**BRD-009 — Lista tablic · Must · faza 2 · 🟡**
AC1: pozycja menu „Tablice" prowadzi do listy tablic dostępnych użytkownikowi; przy jednej
tablicy przekierowuje wprost na nią.

---

## 13. Backlog i sprinty (`SPR`)

**SPR-001 — Sprint jako iteracja tablicy · Must · faza 6 · 📐**
Opis: nazwa, zakres dat, cel, stan (`Planned`/`Active`/`Closed`).
AC1: aktywny sprint na tablicy jest najwyżej jeden — egzekwuje **indeks częściowy bazy**, nie kod.

**SPR-002 — Backlog i planowanie · Must · faza 6 · 📐**
Opis: podstrona tablicy: dwie listy obok siebie, przeciąganie między nimi, suma estymat w nagłówku.
AC1: kolejność w backlogu używa tego samego mechanizmu ranku, co kolumny tablicy.

**SPR-003 — Zamknięcie sprintu · Must · faza 6 · 📐**
AC1: niedokończone zgłoszenia trafiają do backlogu albo do wskazanego sprintu **jawną decyzją
użytkownika**, nigdy domyślnie.
AC2: zamknięty sprint jest tylko do odczytu; jego skład zamraża się na potrzeby raportu.

**SPR-004 — Wykres burndown · Could · faza 8 · 📐**
AC1: liczy z historii zmian stanów, nie z osobnej tabeli migawek.

---

## 14. Rejestracja czasu (`TIME`)

> **Przesunięcie z fazy 7 do 6.** Rejestracja czasu wygląda na funkcję „na potem", dopóki nie
> policzy się, kto na tym systemie pracuje: jednym z trzech aktorów jest kierownictwo, którego
> **jedyne** pytanie brzmi „ile godzin który dział poświęcił na które zagadnienie". Raport nie
> zadziała wstecz — dane muszą się zbierać od momentu, w którym zespoły zaczną pracować.
> Ekrany raportowe zostają w fazie 7; zbieranie danych wchodzi z fazą 6.

**TIME-001 — Wpis czasu · Must · faza 6 · 📐**
Opis: `work_log(issue_uuid, user_uuid, date, minutes, kind, description)`.
AC1: wpis należy do zgłoszenia i osoby; agreguje się do rodzica w hierarchii.
AC2: `kind` (`Rozwój`/`Testy`/`Analiza`/`Spotkanie`) pochodzi ze słownika projektu.
AC3: wpis da się dodać z karty zgłoszenia w dwóch kliknięciach — rejestracja czasu, której
wprowadzenie trwa dłużej niż minuta, nie jest wypełniana i raport z niej kłamie.

**TIME-002 — Czas spędzony wobec estymaty · Should · faza 6 · 📐**
AC1: karta pokazuje estymatę, sumę wpisów i różnicę; system **nie ostrzega** o przekroczeniu —
to decyzja lidera, nie systemu.

**TIME-004 — Czas jest przypisywalny do zagadnienia, nie tylko do projektu · Must · faza 6 · 📐**
Opis: wpis czasu dziedziczy kontekst zgłoszenia, a zgłoszenie może realizować zlecenie z innego
działu (`REQ-002`). Suma godzin musi dać się policzyć **po łańcuchu `realizuje`**, nie tylko
po projekcie, w którym wpis powstał.
AC1: godziny zalogowane w projekcie `WMS-DEV` na zgłoszeniu realizującym zlecenie `LOG-14`
pokazują się w rozliczeniu zagadnienia `LOG-14` z etykietą działu wykonawczego.
AC2: zapytanie agregujące schodzi po powiązaniach rekurencyjnym CTE, nie pętlą po zgłoszeniach.
AC3: godziny nie są liczone podwójnie, gdy zgłoszenie realizuje dwa zlecenia — wtedy agregat
raportuje je osobno per zlecenie i **jawnie oznacza**, że sumowanie obu daje nadmiar.
Uzasadnienie: bez tego dyrektor dostaje „dział WMS: 800 h" i zero odpowiedzi na pytanie,
na co poszły.

**TIME-003 — Granica z kadrami · Must · zawsze · ✅ (przez brak)**
Opis: `work_log` służy szacowaniu pracy w projekcie, **nie rozliczaniu pracownika**.
AC1: moduł nie eksportuje wpisów do rozliczeń i nie zna stawek, urlopów ani grafików.

---

## 15. Zlecenia międzydziałowe (`REQ`)

**REQ-001 — Zlecenie to zgłoszenie w projekcie `Intake` · Must · faza 5 · 📐**
Opis: brak osobnego agregatu — ten sam `Issue`, ten sam komplet pól, komentarzy i historii.
AC1: zlecenie ma własny cykl życia (schemat stanów projektu `Intake`), niezależny od cyklu
zgłoszeń wykonawczych.

**REQ-002 — Powiązanie `realizuje` · Must · faza 5 · 📐**
AC1: jedno zlecenie może być realizowane przez wiele zgłoszeń w wielu projektach.
AC2: zamawiający widzi nagłówki zgłoszeń realizujących bez członkostwa (`PERM-004`).

**REQ-003 — Postęp bez ręcznego przepisywania · Must · faza 5 · 📐**
Opis: zamknięcie zgłoszenia wykonawczego publikuje zdarzenie domenowe, nasłuch przelicza
`derived_delivery_state` na zleceniu.
AC1: zamawiający widzi postęp bez prawa zapisu w projekcie wykonawczym.

**REQ-004 — Odbiór jest decyzją człowieka · Must · faza 5 · 📐**
AC1: zlecenie **nie zamyka się automatycznie** po zamknięciu zgłoszeń realizujących.
AC2: odbiór jest przejściem z `required_permission` w schemacie projektu `Intake`.
AC3: zamawiający może zgłosić zastrzeżenia — przejście z powrotem, z komentarzem wymaganym.

**REQ-005 — Terminy i eskalacje · Should · faza 5 · 📐**
Opis: usługa cykliczna skanuje po indeksie `(due_at) where state_category <> 'Done'`,
oznaczona `[ClusterSafe]`.
AC1: rozdzielczość dzienna; brak wpisu harmonogramu per zgłoszenie.
AC2: przypomnienie i przekroczenie terminu idą jako `UserNotificationRequested`, odbiorców
wylicza ten moduł.

**REQ-006 — Strona zleceń · Must · faza 5 · 📐**
Opis: `/task-management/request` — ta sama mechanika listy, zawężona do projektów `Intake`,
z kolumnami: termin, stan realizacji, dział wykonawczy, po terminie tak/nie.
AC1: osobna strona, bo wchodzi na nią inna rola; karta zlecenia to karta zgłoszenia.

---

## 16. Powiadomienia (`NTF`)

**NTF-001 — Moduł wylicza odbiorców, Notification doręcza · Must · faza 5 · 📐**
AC1: `TaskManagement` publikuje `UserNotificationRequested` z listą odbiorców i nic poza tym.
AC2: grupowanie, preferencje, kanały i skrzynka należą do Notification
([`user-notifications.md`](./user-notifications.md)).

**NTF-002 — Zdarzenia powiadamiające · Must · faza 5 · 📐**
Lista zamknięta w fazie 5: przypisano mi zgłoszenie, wzmianka, nowy komentarz na obserwowanym,
zmiana stanu na obserwowanym, zbliża się/minął termin, zlecenie zrealizowane, zlecenie odebrane.
AC1: sprawca zmiany **nie dostaje** powiadomienia o własnej zmianie.

**NTF-003 — Preferencje per projekt · Could · faza 8 · 📐**

**NTF-004 — Realtime · Must · fazy 0–2 · ✅**
Opis: sygnatury `taskmgmt.issue`, `taskmgmt.board`, `taskmgmt.project`, `taskmgmt.issue_comment`,
`taskmgmt.issue_attachment`, docelowo `taskmgmt.sprint`.
AC1: rejestracja w `AggregateSignatures` zgadza się co do znaku z `signalrSignature` orkiestratorów.

---

## 17. Operacje masowe (`BULK`)

**BULK-001 — Kontrakt bez nowego mechanizmu · Must · faza 6 · 🟡**
Opis: `BatchCommand<T,TFilter>` → `BatchResult{JobUuid}` → `job`/`job_item`, sukces częściowy.
AC1: metoda agregatu waliduje **przed** zmianą stanu — na tym stoi częściowy sukces.
AC2: pre-check regułami `IBatchRule` odrzuca całość, zanim powstanie zadanie, gdy warunek jest
niespełnialny dla wszystkich celów.

**BULK-002 — Zestaw operacji · Must · faza 6 · 📐**
Zmiana stanu, przypisanie, priorytet, dodanie/usunięcie tagu, dodanie do sprintu, przeniesienie
do projektu, migracja stanów po publikacji schematu.
AC1: każda ma własny zestaw reguł wstępnych ([`batch-validation.md`](./batch-validation.md)).

**BULK-003 — Zaznaczenie jako zakres · Must · faza 6 · 📐**
AC1: „Zaznacz wszystko" jest filtrem, nie listą uuid-ów, i przechodzi progiem materializacji
([`selection-scope.md`](../frontend/selection-scope.md)).

---

## 18. Automatyzacje (`AUT`)

**AUT-001 — Reguła jako dana · Could · faza 8 · 📐**
Opis: `when` (zdarzenie: utworzenie, zmiana stanu, komentarz, upłynięcie terminu) →
`if` (warunek w tym samym wąskim języku, co `guard`) → `then` (akcja z zamkniętej listy:
ustaw pole, przypisz, dodaj tag, dodaj komentarz, wyślij powiadomienie, utwórz podzadanie).
AC1: **żadnych skryptów** — lista akcji jest zamknięta i typowana
([§24.9](#249-skrypty-w-automatyzacjach)).
AC2: reguła wykonuje się jako komenda z własną korelacją; jej efekt jest w historii oznaczony
jako pochodzący z automatyzacji, nie jako zmiana użytkownika.
AC3: łańcuch reguł ma twardy limit głębokości; przekroczenie zatrzymuje wykonanie i loguje —
reguła wywołująca samą siebie nie może zjeść instancji.

**AUT-002 — Podgląd i wyłączenie reguły · Could · faza 8 · 📐**
AC1: reguła ma licznik wykonań i log ostatnich uruchomień; da się ją wyłączyć bez usuwania.

---

## 19. Raporty i dashboardy (`RPT`)

**RPT-001 — Raporty przez wspólny mechanizm · Must · faza 7 · 📐**
Opis: `ReportRun` + `IReportDefinition` ([`reporting.md`](./reporting.md)) — nie własny silnik
i nie osobny mikroserwis.
AC1: ciężki przebieg idzie na slot `Map`/`Reduce` z izolacją zasobów, nie na wątku HTTP.
AC2: raport zwracający więcej niż ekran danych kończy się artefaktem do pobrania istniejącym
mechanizmem (`job.kind`, MinIO, wygasanie), nie stroną z tysiącem wierszy.

**RPT-002 — Rozliczenie godzin per dział · Must · faza 7 · 📐**
Warunek wstępny: `taskmgmt.report.read.all` (`PERM-005`) albo `Lead` — wtedy zawężone do
własnych projektów.
Opis: **główny ekran kierownictwa.** Godziny z `work_log` w rozbiciu na dział wykonawczy
(= projekt, [§24.2](#242-dział-jako-byt)), zagadnienie (zlecenie lub epik) i okres.
AC1: wiersz „dział × zagadnienie × godziny" da się zbudować dla zakresu dat i dla wybranych
działów, a suma zgadza się z sumą wpisów w tym okresie.
AC2: godziny zalogowane na zgłoszeniach realizujących zlecenie są przypisane do zagadnienia
tego zlecenia (`TIME-004`), nie do projektu wykonawczego.
AC3: raport pokazuje **nazwy działów i zagadnień, nie treść zgłoszeń** — kierownictwo bez
członkostwa nie dowiaduje się z niego, czego dotyczyły konkretne zadania (`PERM-005` AC2).
AC4: brak wpisów czasu w okresie jest pokazany jako „brak danych", nie jako zero godzin —
to dwie różne informacje dla kogoś, kto podejmuje decyzję o etatach.

**RPT-003 — Zestaw startowy · Should · faza 7 · 📐**
Zgłoszenia wg stanu/typu/przypisanego, czas realizacji per kategoria stanu, dotrzymanie SLA
zleceń, postęp sprintu, obciążenie osób w sprincie.

**RPT-004 — Dashboard dopiero, gdy są dane · Must · zawsze · ✅ (przez brak)**
AC1: pozycja menu bez działającej strony nie wchodzi do `entry.menu.ts` — to błąd usunięty
w fazie 0 i nie wraca.
AC2: kolejność jest wymuszona danymi: `work_log` zbiera się od fazy 6, ekran raportu wchodzi
w fazie 7. Odwrotna kolejność daje ekran świecący pustkami przez kwartał.

---

## 20. API i integracje (`API`)

**API-001 — Kontrakt komendowy, nie CRUD-owy · Must · zawsze · ✅**
Opis: endpointy nazywane pięcioma czasownikami (`create`/`set`/`add`/`remove`/`exec`);
nazwa klasy endpointu → nazwa metody klienta NSwag ([`endpoint-naming.md`](./endpoint-naming.md)).
AC1: nie ma `PATCH /issues/{id}` przyjmującego dowolny zestaw pól
([§24.4](#244-crud-owe-api-put--patch)).
AC2: przemianowanie klasy endpointu jest zmianą łamiącą i wymaga regeneracji klienta.

**API-002 — Idempotencja · Must · zawsze · ✅**
AC1: każda komenda niesie `X-Request-Id`; powtórzone żądanie nie tworzy drugiego zgłoszenia.

**API-003 — Klucz integracyjny · Could · faza 8 · 📐**
Opis: dostęp maszynowy przez klienta Keycloak z własnym zestawem uprawnień, nie przez token
użytkownika w cudzym imieniu.

**API-004 — Webhooki wychodzące · Could · faza 8 · 📐**
Opis: `issue.created`, `issue.state.changed`, `comment.created` — wysyłka przez outbox,
z ponowieniami i wyłączeniem po serii błędów.
AC1: webhook nie jest wysyłany z transakcji komendy.

**API-005 — Linki zewnętrzne · Should · faza 6 · 📐**
Opis: repozytorium kodu, PR-y i CI wchodzą jako **link zewnętrzny na zgłoszeniu**, nigdy jako
integracja w `TaskManagement.Domain`.

**API-006 — Import i eksport · Could · faza 8 · 📐**
AC1: eksport listy idzie istniejącym mechanizmem artefaktów (`job.kind`, MinIO, wygasanie).

---

## 21. Audyt i wymagania niefunkcjonalne (`NFR`)

**NFR-001 — Wieloinstancyjność · Must · zawsze · ✅**
AC1: żadnej usługi tła bez `[ClusterSafe(powód)]` — egzekwuje `BackgroundServiceTests`.
AC2: brak stanu współdzielonego w pamięci procesu; sekwencje i dzierżawy przez Postgresa.

**NFR-002 — Granice warstw · Must · zawsze · ✅**
AC1: `Erp.ArchitectureTests` przechodzi; `Domain` nie zna EF ani ASP.NET.
AC2: rejestracje DI idą skanem zestawów, nie dopiskami w `Program.cs`.

**NFR-003 — Wydajność listy · Must · faza 3 · 🟡**
AC1: lista 100 zgłoszeń z filtrem, sortowaniem po slocie i predykatem widoczności odpowiada
poniżej 300 ms przy 200 tys. zgłoszeń w bazie.
AC2: zapytanie listy nie wykonuje N+1 na polach niestandardowych ani na nazwach stanów.

**NFR-004 — Wydajność tablicy · Must · faza 2 · ✅**
AC1: tablica z 300 kartami renderuje się i przyjmuje przeciągnięcie bez przeliczania całej kolekcji.

**NFR-005 — Audyt zmian · Must · faza 1 · ✅**
AC1: każda zmiana zgłoszenia ma autora, czas i korelację; historia jest nieusuwalna.
AC2: korelacja (`X-Request-Id`) pozwala połączyć wpis historii, zadanie masowe i log serwisu.

**NFR-006 — Tłumaczenia · Must · zawsze · ✅**
AC1: zero hardcoded stringów; `keys.ts` autogenerowany (`pnpm translate:keys`).
AC2: nazwy stanów, typów i pól pochodzą z danych i mogą nie mieć klucza — wtedy wyświetlana jest
nazwa własna. To jedyne dopuszczone wyjście poza registry.

**NFR-007 — Obsługa błędów · Must · zawsze · ✅**
AC1: błędy domenowe wracają jako `ProblemDetails` z kodem tłumaczonym w `shared.errors.codes`.

**NFR-008 — Dostępność zgłoszenia po latach · Should · faza 6 · 📐**
AC1: archiwizacja projektu nie łamie linków; klucz zgłoszenia jest wieczysty.

**NFR-009 — Warstwa prezentacji z gotowych komponentów · Must · zawsze · 🟡**
Opis: ekrany składa się z komponentów, nie z HTML-a. Kolejność sięgania jest sztywna:
`@erp/shared/ui` → komponent w `@erp/task-management/ui` → dopiero wtedy własny szablon.
AC1: komponent prezentacyjny **nie mieszka w `feature`** — `feature` trzyma smart components
(logika, store, orkiestrator), `ui` trzyma dumb components ([`feature-structure.md`](../frontend/feature-structure.md)).
AC2: zdolność brakująca w komponencie współdzielonym (np. wklejanie obrazów w `erp-rich-text`)
dokładana jest **do niego**, nie obchodzona lokalnie — inaczej powstaje trzecia kopia tego samego
kodu w trzecim module.
AC3: nowy atom w `libs/modules/task-management/ui` powstaje wg wzorca „Single Config Builder"
([`atoms.md`](../frontend/atoms.md)), z `erp-` w selektorze.
Stan dzisiaj: `libs/modules/task-management/ui` zawiera **wyłącznie tłumaczenia** — karta tablicy,
kolumna, wątek komentarzy i historia leżą w `feature`. To dług do spłacenia w fazie 4.

**NFR-010 — Rozmieszczenie elementów wzorowane na YouTracku · Must · faza 4 · 📐**
Opis: użytkownicy przychodzą z YouTracka i mają odnaleźć elementy tam, gdzie ich szukają.
Wiążące rozmieszczenie per ekran →
[`task-management-pages.md` §9](../frontend/task-management-pages.md#9-układ-ekranów--wzorzec-youtracka).
AC1: karta zgłoszenia to dwie kolumny — treść po lewej, **panel pól po prawej**; stan i przejścia
na górze panelu.
AC2: komentarze i historia to **jeden strumień aktywności z filtrem**, nie dwie osobne sekcje
i nie zakładki.
AC3: pole komentarza jest zakotwiczone na dole strumienia i widoczne bez przewijania do końca.

---

## 22. Zakres MVP i fazy

Fazy 0–3 są **wdrożone**; numeracja jest ciągła z
[`task-management.md` §13](./task-management.md#13-kolejność-wdrożenia), żeby nie unieważniać
istniejących odwołań.

| Faza | Nazwa | Zakres wymagań | Stan |
|---|---|---|---|
| 0 | Fundament | PRJ-001/002, ISS-001/002/003/006/011, SRCH-001/002, PERM-001/002, MEM-001 | ✅ |
| 1 | Automat stanów i dyskusja | WF-001/002/003/005, CMT-001/002/003, HIS-001, ATT-001, ISS-004 | ✅ |
| 2 | Tablica | BRD-001..005, BRD-008, NFR-004 | ✅ |
| 3 | Konfiguracja per projekt | FLD-001/003/004, PRJ-005, HIS-002, NFR-003 | ✅ |
| 4 | **Typy, graf, układ i domknięcie karty** | TYP-001..004, LNK-001..006, WF-004, FLD-002/005/006, ISS-005, CMT-006, NFR-009/010 | 🟡 |
| 5 | **Zlecenia i powiadomienia** | REQ-001..006, NTF-001/002, ISS-009, CMT-004, PERM-003/004, PRJ-006 | 📐 |
| 6 | **Dojrzałość narzędzia + zbieranie godzin** | SPR-001..003, BULK-001..003, TAG-001/002, SRCH-003/004, ISS-007/008/010, TIME-001/002/004, BRD-006/007/009, PRJ-003/004, ATT-002, API-005, NFR-008 | 📐 |
| 7 | **Konfiguracja z UI i raporty** | WF-006/007, VIEW-001/002, RPT-001..003, PERM-005, TAG-003 | 📐 |
| 8 | **Rozszerzenia** | AUT-001/002, SRCH-005, API-003/004/006, SPR-004, NTF-003 | 📐 |

**MVP użytkowe kończy się na fazie 6, ale nie na niej kończy się MVP dla wszystkich trzech
aktorów.** Po fazie 6 zespół dev i biznes mają komplet: zgłoszenia z własnymi polami, tagami
i typami, tablica, sprinty, zlecenia, powiadomienia, wyszukiwanie i operacje masowe — a godziny
**zaczynają się zbierać**. Kierownictwo dostaje swój ekran w fazie 7, na danych, które już są.

Dwie zmiany kolejności wobec pierwotnego podziału, obie wymuszone tym, kto na tym systemie
pracuje: **rejestracja czasu przesunięta z 7 do 6** (raport nie zadziała wstecz) i **raporty
przesunięte z 8 do 7** (kierownictwo jest aktorem, nie odbiorcą rozszerzeń).

Podział na strony frontu per faza →
[`task-management-pages.md` §9](../frontend/task-management-pages.md#9-kolejność-względem-faz-wdrożenia).

---

## 23. Poza zakresem modułu

| Kuszące | Właściciel / dlaczego nie |
|---|---|
| Obieg dokumentu, akceptacje | DMS — dokument to rzecz do zatwierdzenia, zgłoszenie to praca do wykonania |
| Repozytorium kodu, PR-y, CI | Zewnętrzne narzędzie; wchodzi jako link (`API-005`) |
| Czas pracy, urlopy, grafiki | Kadry (`TIME-003`) |
| Baza wiedzy, wiki | Osobna domena — opis zgłoszenia to nie dokumentacja |
| Helpdesk, portal klienta | Osobny produkt; projekt `Intake` obsługuje zlecenia **wewnętrzne** |
| Whiteboardy, diagramy | Poza zakresem ERP |
| Silnik obiegu ogólnego przeznaczenia | Biblioteka `Erp.BuildingBlocks.Workflow` przy trzecim odbiorcy, nie tutaj |
| Doręczanie e-maili i push | Notification |
| Katalog użytkowników, role globalne | Identity |

---

## 24. Decyzje odrzucone

Sekcja istnieje po to, żeby te tematy nie wracały co kwartał.

### 24.1 Organizacja / Workspace
**Odrzucone.** System jest jednoorganizacyjny — jeden realm Keycloak, jeden zestaw modułów ERP.
`Workspace` wprowadziłby drugą oś izolacji w **każdej** tabeli, w każdym predykacie widoczności
i w każdym kluczu czytelnym, nie mając ani jednego odbiorcy. Kontenerem jest `Project`.
Gdyby kiedyś doszła wielofirmowość, jest to zmiana na poziomie całego ERP, nie tego modułu.

### 24.2 „Dział" jako byt
**Odrzucone tutaj.** Dopóki Identity nie ma jednostek organizacyjnych, działem **jest** projekt
i jego zespół. Gdy Identity je dostanie, `project.owner_unit_id` wskaże na nie i nic więcej się
nie zmieni. Druga hierarchia firmy w `taskmgmt` rozjedzie się z pierwszą w ciągu miesiąca.

### 24.3 EAV (`IssueFieldDefinition` + `IssueFieldValue`)
**Odrzucone.** Model wartość-na-wiersz wygląda czysto, dopóki nie trzeba **posortować listy
serwerowo po polu własnym** — wtedy każde pole to osobny `LEFT JOIN`, a filtr po trzech polach
to trzy joiny na najgorętszej tabeli modułu. Wybór: jsonb jako źródło prawdy (dowolna liczba pól)
+ stała pula slotów typowanych dla pól sortowalnych i filtrowalnych. To **ten sam wzorzec,
co typ dokumentu w DMS** — drugie zastosowanie, świadomie nieuogólniane
([`dms-workflow.md` §3.2](./dms-workflow.md#32-sortowalne-atrybuty--sloty-typowane)).

### 24.4 CRUD-owe API (`PUT` / `PATCH`)
**Odrzucone.** `PATCH /issues/{id}` z dowolnym zestawem pól nie daje się zwalidować regułą
domenową (co znaczy „zmiana stanu i przypisanego naraz"?), nie daje się zapisać w historii
pole po polu z sensownym powodem i nie mapuje się na `IBatchRule` operacji masowych.
Kontrakt to komendy nazwane pięcioma czasownikami. Publiczne API dla integracji, gdy powstanie,
jest **fasadą nad komendami**, nie drugim modelem zapisu.

### 24.5 `Versions` i `Components` jako osobne agregaty
**Odrzucone.** To pola słownikowe projektu (`FLD-006`). Osobny agregat = drugi komplet komend,
zapytań, orkiestratorów i ekranów za jedno pole różnicy.

### 24.6 Usuwanie projektów i zgłoszeń
**Odrzucone.** Projekty i zgłoszenia się archiwizuje. Zgłoszenie z rocznym wątkiem komentarzy jest
historią decyzji firmy; twarde usunięcie zostawia martwe linki w mailach, commitach i raportach.
Usuwanie zostaje wyłącznie dla rzeczy pomocniczych (komentarz — miękko, załącznik — z plikiem).

### 24.7 Scalanie zgłoszeń
**Odrzucone (na razie).** Przenoszenie komentarzy i historii między zgłoszeniami psuje audyt:
wpis „Anna zmieniła stan" trafiałby do zgłoszenia, którego Anna nigdy nie dotykała. Duplikat
oznacza się powiązaniem i rozwiązaniem (`ISS-012`).

### 24.8 DSL w MVP
**Przesunięte, nie odrzucone.** Język zapytań ma sens dopiero razem z zapisanymi widokami
i wyszukiwaniem pełnotekstowym; sam w sobie jest trudniejszą wersją formularza filtra.
Warunek konieczny: parser produkuje **ten sam obiekt filtra**, co formularz, i nigdy SQL-a.

### 24.9 Skrypty w automatyzacjach
**Odrzucone.** Wykonywanie kodu z bazy to ta sama decyzja, co przy warunkach na krawędziach
w DMS — zamknięta lista akcji i wąski język warunków. Reguły, której nie da się przeczytać
w macierzy, nie da się też zdebugować rok później.

---

## 25. Zobacz też

- [`task-management.md`](./task-management.md) — model domenowy i mechanika (rank, sloty, widoczność)
- [`PLAN-task-management.md`](../../PLAN-task-management.md) — kolejność prac i checklisty
- [`task-management-pages.md`](../frontend/task-management-pages.md) — podział na strony
- [`cqrs.md`](./cqrs.md), [`endpoint-naming.md`](./endpoint-naming.md) — kontrakt komend
- [`bulk-commands.md`](./bulk-commands.md), [`batch-validation.md`](./batch-validation.md)
- [`identity-authz.md`](./identity-authz.md), [`user-notifications.md`](./user-notifications.md)
- [`multi-instance.md`](./multi-instance.md), [`reporting.md`](./reporting.md)
