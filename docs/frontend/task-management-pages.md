# Task Management — podział na strony

**Stan: ✅ fazy 0–1 wdrożone; pozostałe strony 📐 projekt.** Istnieją dwie trasy — lista
`/task-management/issue` (filtr, tabela serwerowa, akcje masowe) i karta `/task-management/issue/:key`
(opis w `erp-rich-text`, przejścia stanów ze schematu projektu, załączniki, wątek komentarzy
i historia zmian). Zaślepka **„Dashboard Analityczny Zadań"** zniknęła z `entry.menu.ts` razem
z fazą 0 (dashboard robiony pierwszy przez pół roku świeci pustkami). Tablicy, zleceń i grupy „Konfiguracja" w menu nie ma —
pozycja bez działającej strony to ten sam błąd, który usunęła faza 0.

Model domenowy, automat stanów, sloty pól i mechanika kolejności na tablicy →
[`docs/backend/task-management.md`](../backend/task-management.md).
Ten dokument opisuje **wyłącznie podział na strony i nawigację**.

Wzorce, na których stoją te strony: [`pages.md`](./pages.md), [`smart-tables.md`](./smart-tables.md),
[`feature-structure.md`](./feature-structure.md), [`modals.md`](./modals.md),
[`orchestrators.md`](./orchestrators.md).

---

## 1. Zasada podziału

Strony dzielimy **po roli, która na nie wchodzi**, nie po encji. Trzy reguły przesądzają o kształcie
menu — pierwsze dwie są przeniesieniem rozstrzygnięć z DMS-u, trzecia jest nowa:

- **Projekt to kontekst, nie strona.** Wszystkie projekty mieszkają na tej samej liście zgłoszeń,
  przełączane kontekstem projektu, bo to projekt decyduje o zestawie kolumn
  ([`task-management.md` §6](../backend/task-management.md#6-pola-niestandardowe)). Osobna strona
  per projekt oznacza menu rosnące z każdym nowym działem.
- **„Moje zgłoszenia" to zakres, nie strona.** Ten sam `searchIssue` z parametrem `scope`.
- **Tablica to osobna strona, nie widok listy.** Tu odchodzimy od schematu „jedna encja, jedna
  strona z przełącznikami": tablica ma inny model interakcji (przeciąganie, kolumny ze stanów,
  swimlane'y), inny orkiestrator kolejności i inne zachowanie realtime. Wciśnięcie jej w tabelę
  jako „widok" kończy się komponentem z dwoma trybami, które nie dzielą niczego poza filtrem.

---

## 2. Grupa A — praca codzienna

### 2.1 Zgłoszenia — `/task-management/issue`
Lista serwerowa: `erp-grid-layout` + filtr + smart tabela + action toolbar ([`pages.md`](./pages.md)).
Dwa przełączniki nad tabelą:

- **zakres**: `Moje` / `Zgłoszone przeze mnie` / `Obserwowane` / `Mojego zespołu` / `Wszystkie dostępne`,
- **projekt**: zmienia zestaw kolumn (pola niestandardowe) i **resetuje sortowanie oraz filtry
  projekto-specyficzne** — inaczej front wyśle `sort` po kolumnie, której w nowym kontekście nie
  ma, i backend odrzuci żądanie na whiteliście.

Kolumny projekto-specyficzne są dostępne **wyłącznie** przy zawężeniu do jednego projektu.
Ich definicja pochodzi z `getProjectFieldProfile`, nie ze stałej w komponencie — `ErpTableBuilder`
buduje `computed<ErpTableConfig>` z profilu ([`smart-tables.md`](./smart-tables.md)).

Wiersz to zawsze `Issue` (w każdym zakresie) — w odróżnieniu od listy dokumentów DMS, gdzie klucz
wiersza zmienia się z zakresem. Tutaj nie ma czynności, więc dedup nie ma czego zgubić.

Zaznaczenie i akcje masowe idą przez pełny [`ErpSelectionScope`](./selection-scope.md) — zmiana
stanu, przypisanie i dodanie do sprintu na kilkuset zgłoszeniach to zwykłe zadanie masowe.

### 2.2 Tablica — `/task-management/board/:uuid` ✅
**Strona, która świadomie łamie wzorzec `erp-grid-layout` + filtr + tabela** — zapisane tutaj,
żeby przy review nie wyglądało na niedbalstwo. Drugi taki przypadek w systemie po edytorze
szablonu obiegu w DMS.

Kolumny wyprowadzone ze stanów schematu projektu, swimlane'y (po przypisanym / epiku / priorytecie),
karty przeciągane między kolumnami i w pionie.

Trzy rzeczy, których nie robi dziś żaden ekran w systemie:

1. **Optymistyczne przestawienie z cofnięciem.** Karta ląduje w nowym miejscu natychmiast, komenda
   `setBoardCardPosition` leci z `beforeUuid`/`afterUuid` (nie z wyliczonym rankiem — liczy go
   serwer, [`task-management.md` §7.2](../backend/task-management.md#72-rank-jest-łańcuchem-nie-liczbą-całkowitą)).
   Odpowiedź `409` cofa ruch i pokazuje toast.
2. **Pomijanie echa własnej zmiany.** Orkiestrator pomija odświeżenie kart, dla których leci
   własna, jeszcze niepotwierdzona komenda. Bez tego karta przeskakuje pod kursorem w trakcie
   przeciągania. **Odstępstwo od pierwotnego projektu:** miało to iść po korelacji
   (`X-Request-Id` → `CorrelationId`), ale hub rozsyła dziś `ReceiveUpdates(sygnatura, uuid-y)`
   bez korelacji — rozszerzanie kontraktu realtime dla jednego ekranu byłoby drożej niż zbiór
   uuid-ów w orkiestratorze ([`task-management.md` §7.3](../backend/task-management.md#73-współbieżność-i-echo-własnej-zmiany)).
3. **Przeciąganie w kolumnę, do której przejście jest niedozwolone.** Kolumna niedostępna dla
   danej karty jest wygaszana **w chwili chwycenia karty**, na podstawie przejść ze schematu.
   Poznanie tego dopiero z błędu po upuszczeniu jest wrogie użytkownikowi.

Przejście wymagające pól (`required_fields`) otwiera modal przed potwierdzeniem ruchu — karta
wisi w stanie „w toku" do zamknięcia modala.

**Czego faza 2 świadomie nie dowozi**: swimlane'ów (drugi wymiar grupowania nad tym samym
mechanizmem kolejności — nie on jest pytaniem tej fazy) i modala pól wymaganych przy przejściu
(`required_fields` to pola niestandardowe, czyli faza 3). Strona rysuje dziś kolumny wprost
ze stanów schematu projektu.

### 2.3 Karta zgłoszenia — `/task-management/issue/:key`
**Osobna strona, nie prawy panel przy tabeli.** Powód jest praktyczny: opis, komentarze i historia
muszą dominować ekran, a link do zgłoszenia (`/issue/DEV-412`) krąży w mailach i musi otwierać
pełny widok.

Trasa idzie po **kluczu czytelnym**, nie po UUID. Stare klucze przekierowują na bieżący
(`issue.previous_keys`, [`task-management.md` §4](../backend/task-management.md#4-klucz-czytelny-dev-123)) —
inaczej każdy link sprzed przeniesienia projektu jest martwy.

Layout: kolumna główna (tytuł, opis, załączniki, komentarze, historia), panel boczny (stan
i dostępne przejścia, przypisany, priorytet, termin, sprint, pola niestandardowe **budowane
w runtime z profilu projektu**), pasek powiązań (rodzic, podzadania, blokady, zlecenie).

**Załączniki** (`erp-task-management-issue-attachments`, sekcja pod opisem) mają trzy decyzje
przeniesione z multimediów Catalogu i jedną własną:

- **pliki wgrywają się od razu po wybraniu**, nie za przyciskiem zapisu — karta zgłoszenia
  żadnego „zapisz całość" nie ma, a transfer schowany za przyciskiem zamienia ekran
  w zawieszony formularz bez informacji zwrotnej;
- **bajty nie idą przez mikroserwis** — bilet (`getIssueAttachmentUploadTickets`) → `PUT` prosto
  do magazynu → rejestracja paczki jedną komendą w jednej transakcji, pod jednym `X-Request-Id`;
- **podgląd przez `blob:`**, nie przez adres endpointu w `src` — zawartość jest za uprawnieniem,
  a `<img>` nie dokłada nagłówka `Authorization` ([`multimedia.md` §3](./multimedia.md#3-miniaturki-blob-nie-adres-endpointu));
  miniatur pochodnych tu nie ma, więc adres zamawia dopiero kafelek obrazu, nie każdy wiersz;
- **usuwania nie ma i nie jest to przeoczenie** — plik należy do zgłoszenia i znika razem z nim
  w tej samej transakcji ([`media-storage.md` §4c](../backend/media-storage.md)), więc backend
  nie wystawia komendy kasującej pojedynczy załącznik.

**Komentarze** (`erp-task-management-issue-comments`) i **historia** (`…-issue-history`) to dwie
osobne sekcje pod załącznikami, nie zakładki — karta czyta się w jednej kolumnie, od tego,
czym zgłoszenie jest, do tego, co się z nim działo. Trzy rzeczy warte zapamiętania:

- **wątek jest jednopoziomowy**, bo taka jest reguła domeny, a nie uproszczenie widoku
  ([`task-management.md` §11](../backend/task-management.md#11-historia-zmian-i-komentarze));
  odpowiedź składa się w jednym przebiegu po płaskiej liście, bez rekurencji;
- **po zapisie nic nie dopisujemy do listy ręcznie** — komenda idzie zadaniem, a wątek wraca
  zdarzeniem na kanale `taskmgmt.issue_comment`, tą samą drogą, którą przychodzi cudza
  wypowiedź; optymistyczne wstawienie dałoby przez chwilę dwa komentarze;
- **zdanie w historii składa szablon, nie backend**: serwer zapisuje rodzaj wpisu, kod pola
  i surowe wartości, a nazwa pola jest kluczem tłumaczenia, więc przechodzi przez `erpTranslate`
  jako parametr drugiego `erpTranslate` (Transloco nie rozwiązuje kluczy zagnieżdżonych
  w parametrach — złożenie tego w TS wypisałoby użytkownikowi surowy klucz).

> **Uuid zamiast nazwiska.** Autor komentarza, aktor zmiany i przypisany pokazują się dziś jako
> uuid — front nie ma katalogu użytkowników w żadnym module. To jedna pozycja do zrobienia,
> nie trzy: rozwiązuje ją wspólny słownik z Identity, nie lokalne obejście na karcie.

> **Obrazki osadzone w treści opisu to osobna pozycja, jeszcze niezrobiona.** Backend jest na nie
> gotowy (`GET issue/attachment/content/{uuid}` z trwałym adresem), ale ten adres wymaga tokenu,
> więc `<img>` w zapisanym HTML-u sam się nie wyrenderuje. Wymaga to podmiany `src` na `blob:`
> przy wyświetlaniu i z powrotem przy zapisie — w obu kierunkach i w obu trybach (podgląd
> i edytor). Do czasu tej decyzji `TuiEditorTool.Img` świadomie nie wchodzi do żadnego zestawu
> narzędzi `erp-rich-text`, a pliki dopina się obok treści.

### 2.4 Backlog i planowanie sprintu — `/task-management/board/:uuid/backlog`
Podstrona tablicy scrumowej, nie osobna pozycja w menu: dwie listy obok siebie (backlog ↔ sprint),
przeciąganie między nimi, suma estymat w nagłówku sprintu.

Wchodzi dopiero z fazą 6 — tablica kanban jest użyteczna bez backlogu, odwrotnie nie.

---

## 3. Grupa B — zlecenia

### 3.1 Zlecenia — `/task-management/request`
Ten sam mechanizm, co lista zgłoszeń, ale **zawężony do projektów typu `Intake`** i z innym
domyślnym zestawem kolumn: termin, stan realizacji wyprowadzony z powiązanych zgłoszeń
(`derived_delivery_state`), dział wykonawczy, po terminie tak/nie.

Osobna strona mimo tej samej encji, bo **wchodzi na nią inna rola** — kierownik działu
zamawiającego nie ma po co oglądać tablicy sprintowej działu dev, a jego pytanie brzmi „co z moim
zleceniem", nie „co robimy w tej iteracji".

Akcje: złóż zlecenie, odbierz realizację (przejście z uprawnieniem), zgłoś zastrzeżenia.

### 3.2 Karta zlecenia
Nie ma osobnej trasy — to karta zgłoszenia (§2.3), na której pasek powiązań pokazuje zgłoszenia
realizujące z ich stanami. Zamawiający widzi **nagłówki**, nie treść cudzych zgłoszeń
([`task-management.md` §10.1](../backend/task-management.md#101-widoczność-liczona-po-projekcie)).

---

## 4. Grupa C — konfiguracja

### 4.1 Projekty — `/task-management/project`
Lista projektów: kod, typ (`Delivery`/`Intake`), lead, liczba otwartych zgłoszeń, schemat pól,
schemat stanów.

### 4.2 Karta projektu — `/task-management/project/:uuid`
Master-detail z zakładkami: **pola** (definicje + **mapowanie na sloty**), **stany** (wybór
schematu), **tablice**, **członkowie** (`project_member` z rolą), **SLA**.

Tu żyje ostrzeżenie „slot już użyty, mapowania nie zmienisz"
([`task-management.md` §6](../backend/task-management.md#6-pola-niestandardowe)) — identyczne co do
treści z ostrzeżeniem przy typach dokumentów w DMS.

### 4.3 Schematy stanów — `/task-management/workflow-scheme/:uuid`
Edytor stanów i przejść. **Nie canvas grafu** — automat jest sekwencyjny, więc dwie listy
(stany, przejścia) plus macierz „z → do" są czytelniejsze i tańsze niż rysowanie
([`task-management.md` §5.4](../backend/task-management.md#54-dlaczego-nie-silnik-z-dms-u)).
To świadoma różnica względem edytora obiegu w DMS, nie niedoróbka.

Publikacja zmiany otwiera **modal mapowania stanów** dla zgłoszeń siedzących w usuwanych stanach;
zatwierdzenie uruchamia zadanie masowe z postępem
([`task-management.md` §5.3](../backend/task-management.md#53-zmiana-schematu-a-istniejące-zgłoszenia)).

---

## 5. Czego świadomie NIE robimy osobną stroną

| Kuszące | Dlaczego nie |
|---|---|
| „Moje zgłoszenia" | Zakres na liście. Osobna strona zmusza użytkownika do zgadywania, gdzie patrzeć |
| Strona per projekt / per dział w menu | Kontekst projektu na jednej liście — inaczej N kopii tego samego ekranu |
| Osobna lista podzadań | Hierarchia to tryb drzewa na liście zgłoszeń i pasek powiązań na karcie |
| „Uprawnienia i role" | Identity ([`identity-authz.md`](../backend/identity-authz.md)). Tu zostaje wyłącznie zakładka członków na karcie projektu |
| Dashboard / burndown / raporty | Po fazie 6, gdy są dane. Dzisiejsza zaślepka w menu jest dokładnie tym błędem |
| Osobna strona sprintów | Sprint to podstrona tablicy — poza tablicą nie ma sensu |

---

## 6. Struktura katalogów i modale

Agregaty w `libs/modules/task-management/feature/src/lib/`, każdy wg
[`feature-structure.md`](./feature-structure.md) (`components`/`modal`/`page`/`translation`):

```
issue/   board/   project/   workflow-scheme/   request/
```

Modale ([`modals.md`](./modals.md)): nowe zgłoszenie, przejście stanu z wymaganymi polami,
przypisanie, dodanie powiązania (wyszukiwarka po kluczu), przeniesienie do projektu (**ostrzeżenie
o zmianie klucza**), złożenie zlecenia, odbiór zlecenia, mapowanie stanów przy publikacji schematu,
podsumowanie operacji masowej.

Definicje modali **nie wywołują** `.setProviders(...)` — providery wstrzykuje `ErpModalService`
z `getModalProviders()` kontraktu remota.

Sygnatury SignalR do orkiestratorów: `taskmgmt.issue`, `taskmgmt.board`, `taskmgmt.sprint`,
`taskmgmt.project` ([`orchestrators.md`](./orchestrators.md)).

**Osobny orkiestrator kolejności.** `BoardOrchestrator` trzyma karty po UUID i utrzymuje porządek
po `(rank, issueUuid)`; `IssueOrchestrator` trzyma treść zgłoszeń. Jeden orkiestrator na oba
zadania musiałby przeliczać porządek przy każdej zmianie tytułu.

---

## 7. Menu i uprawnienia

Każda pozycja `entry.menu.ts` dostaje `requiredPermission` — obecna zaślepka nie ma żadnego
(dla porównania: menu Catalogu ma je na każdej pozycji). Grupa „Konfiguracja" musi być niewidoczna
dla zwykłego członka zespołu.

```
Zgłoszenia                → /task-management/issue          (taskmgmt.issue.read)
Tablice                   → /task-management/board          (taskmgmt.issue.read)
Zlecenia                  → /task-management/request        (taskmgmt.issue.read)
Konfiguracja
  ├ Projekty              → /task-management/project        (taskmgmt.project.manage)
  └ Schematy stanów       → /task-management/workflow-scheme(taskmgmt.scheme.manage)
```

Karta zgłoszenia (`/issue/:key`) i konkretna tablica (`/board/:uuid`) nie mają pozycji w menu —
wchodzi się na nie z listy. Pozycja „Tablice" prowadzi do listy tablic dostępnych użytkownikowi;
przy jednej tablicy przekierowuje wprost na nią.

---

## 8. Tłumaczenia

Zero hardcoded stringów, klucze z registry (`TASK_MANAGEMENT_KEYS.…`), `keys.ts` autogenerowany
przez `pnpm translate:keys` — nigdy ręcznie ([`translations.md`](./translations.md)).

Trzy zbiory kluczy, których nie ma w innych modułach i o które łatwo się potknąć:

- **nazwy stanów i przejść** pochodzą ze schematu (`name_key`), więc są **danymi wskazującymi na
  klucz tłumaczenia**, nie literałami w szablonie; stan zdefiniowany przez użytkownika bez klucza
  wyświetla nazwę własną — to jedyne dopuszczone wyjście poza registry;
- **nazwy pól niestandardowych** — analogicznie, z profilu projektu;
- **kody błędów przejść** (`taskmgmt.transition_not_allowed`) idą do `shared.errors.codes`
  ([`notifications.md`](./notifications.md)).

---

## 9. Kolejność względem faz wdrożenia

Fazy → [`task-management.md` §13](../backend/task-management.md#13-kolejność-wdrożenia).

| Faza | Strony |
|---|---|
| 0 ✅ | Zgłoszenia (bez pól niestandardowych), Karta zgłoszenia; **usunięcie zaślepki „Dashboard Analityczny Zadań"** |
| 1 ✅ | Karta zgłoszenia — przejścia stanów, komentarze, historia |
| 2 ✅ | **Tablica** (kanban, drag&drop, realtime) |
| 3 | Kontekst projektu na liście, kolumny i filtry z profilu; Karta projektu — zakładka pól |
| 4 | Tryb drzewa na liście, pasek powiązań na karcie |
| 5 | Zlecenia, odbiór; Karta projektu — SLA |
| 6 | Backlog i planowanie sprintu, akcje masowe |
| 7 | Schematy stanów (edytor + mapowanie przy publikacji), zapisane widoki |

Fazy 0–2 to **trzy strony, nie dziesięć** — i to faza 2 odpowiada na pytanie, po co ten moduł
w ogóle powstał.
