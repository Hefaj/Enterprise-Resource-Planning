---
id: module.task-management.screens
title: Task Management — podział na strony
summary: Podział stron, nawigacja i układy ekranów Task Management.
kind: module-specification
scope: task-management
audience:
  - frontend
  - backend
  - agent
triggers:
  - strony Task Management
  - układ listy zgłoszeń tablicy lub projektu
related: []
---

# Task Management — podział na strony

**Stan: ✅ zaimplementowane są lista i karta zgłoszeń, zlecenia, lista i karta projektu,
tablice z backlogiem, raporty oraz konfiguracja projektu.** Menu publikuje wyłącznie te trasy,
które mają działający widok i wymagane uprawnienie; nie zawiera zaślepki „Dashboard Analityczny
Zadań".

Model domenowy, automat stanów, sloty pól i mechanika kolejności na tablicy →
[`docs/modules/task-management/domain.md`](domain.md).
Ten dokument opisuje **wyłącznie podział na strony i nawigację**.

Wzorce, na których stoją te strony: [`pages.md`](../../guides/frontend/pages.md), [`smart-tables.md`](../../guides/frontend/smart-tables.md),
[`feature-structure.md`](../../guides/frontend/feature-structure.md), [`modals.md`](../../guides/frontend/modals.md),
[`orchestrators.md`](../../guides/frontend/orchestrators.md).

---

## 1. Zasada podziału

Strony dzielimy **po roli, która na nie wchodzi**, nie po encji. Trzy reguły przesądzają o kształcie
menu — pierwsze dwie są przeniesieniem rozstrzygnięć z DMS-u, trzecia jest nowa:

- **Projekt to kontekst, nie strona.** Wszystkie projekty mieszkają na tej samej liście zgłoszeń,
  przełączane kontekstem projektu, bo to projekt decyduje o zestawie kolumn
  ([`task-management.md` §6](domain.md#6-pola-niestandardowe)). Osobna strona
  per projekt oznacza menu rosnące z każdym nowym działem.
- **„Moje zgłoszenia" to zakres, nie strona.** Ten sam `searchIssue` z parametrem `scope`.
- **Tablica to osobna strona, nie widok listy.** Tu odchodzimy od schematu „jedna encja, jedna
  strona z przełącznikami": tablica ma inny model interakcji (przeciąganie, kolumny ze stanów,
  swimlane'y), inny orkiestrator kolejności i inne zachowanie realtime. Wciśnięcie jej w tabelę
  jako „widok" kończy się komponentem z dwoma trybami, które nie dzielą niczego poza filtrem.

---

## 2. Grupa A — praca codzienna

### 2.1 Zgłoszenia — `/task-management/issue`
Lista serwerowa: `erp-grid-layout` + filtr + smart tabela + action toolbar ([`pages.md`](../../guides/frontend/pages.md)).
Dwa przełączniki nad tabelą:

- **zakres**: docelowo pięć wartości — `Moje` / `Zgłoszone przeze mnie` / `Wszystkie dostępne` /
  `Obserwowane` / `Mojego zespołu`. **Dziś dostępne są cztery** — `Obserwowane` (`IssueScope.Watched`)
  filtruje po istniejącej encji `IssueWatcher` (aktywny wpis, bez rezygnacji). Brakuje wyłącznie
  `Mojego zespołu`: żaden moduł (Task Management ani Identity) nie ma dziś pojęcia zespołu czy
  przełożonego — wymaga to nowego agregatu domenowego, nie samego wariantu enuma, więc zostaje
  świadomie odłożone. Rozszerzenie zakresu zawsze idzie przez kontrakt (`IssueScope`, `searchIssue`)
  i, gdy backend niesie nazwy wariantów, regenerację klienta NSwag — nigdy przez lokalny filtr po
  stronie przeglądarki, który dawałby niepełne wyniki na stronicowanej liście.
- **projekt**: zmienia zestaw kolumn (pola niestandardowe) i **resetuje sortowanie oraz filtry
  projekto-specyficzne** — inaczej front wyśle `sort` po kolumnie, której w nowym kontekście nie
  ma, i backend odrzuci żądanie na whiteliście.

Kolumny projekto-specyficzne są dostępne **wyłącznie** przy zawężeniu do jednego projektu.
Ich definicja pochodzi z `getProjectFieldProfile`, nie ze stałej w komponencie — `ErpTableBuilder`
buduje `computed<ErpTableConfig>` z profilu ([`smart-tables.md`](../../guides/frontend/smart-tables.md)).

Wiersz to zawsze `Issue` (w każdym zakresie) — w odróżnieniu od listy dokumentów DMS, gdzie klucz
wiersza zmienia się z zakresem. Tutaj nie ma czynności, więc dedup nie ma czego zgubić.

Zaznaczenie i akcje masowe idą przez pełny [`ErpSelectionScope`](../../guides/frontend/selection-scope.md) — zmiana
stanu, przypisanie i dodanie do sprintu na kilkuset zgłoszeniach to zwykłe zadanie masowe.

### 2.2 Tablica — `/task-management/board/:uuid` ✅
**Strona, która świadomie łamie wzorzec `erp-grid-layout` + filtr + tabela** — zapisane tutaj,
żeby przy review nie wyglądało na niedbalstwo. Drugi taki przypadek w systemie po edytorze
szablonu obiegu w DMS.

Kolumny wyprowadzone ze stanów schematu projektu, swimlane'y (po przypisanym / epiku / priorytecie
/ polu niestandardowym),
karty przeciągane między kolumnami i w pionie.

Trzy rzeczy, których nie robi dziś żaden inny ekran w systemie:

1. **Optymistyczne przestawienie z cofnięciem.** Karta ląduje w nowym miejscu natychmiast, komenda
   `setBoardCardPosition` leci z `beforeUuid`/`afterUuid` (nie z wyliczonym rankiem — liczy go
   serwer, [`task-management.md` §7.2](domain.md#72-rank-jest-łańcuchem-nie-liczbą-całkowitą)).
   Odpowiedź `409` cofa ruch i pokazuje toast. Idzie przez `ErpOptimisticStore`
   (`BoardStore.dropAsync`, [`optimistic-updates.md`](../../guides/frontend/optimistic-updates.md#9-dwie-komendy-pod-jedną-nakładką--boardstoredropasync)) —
   nie przez lokalny sygnał, jak we wcześniejszej wersji tego ekranu.
2. **Echo własnej zmiany nie przeskakuje kartą pod kursorem — bez rozpoznawania echa.** Nakładka
   pozycji żyje POZA cache'm kart orkiestratora (własny scope `taskmgmt.board.position`) i wygrywa
   z danymi z serwera aż do własnego zdjęcia, więc odświeżenie karty przez zdarzenie SignalR w
   trakcie przeciągania nie ma wpływu na to, gdzie karta jest narysowana. **To NIE jest
   pierwotny projekt** — miało to iść po korelacji (`X-Request-Id` → `CorrelationId`) albo przez
   lokalny zbiór „karty z własną, niepotwierdzoną komendą"
   (`TaskManagementBoardOrchestrator._pendingCardUuids`, dziś usunięty jako martwe rusztowanie bez
   wywołujących) — nakładka optymistyczna rozwiązuje ten sam problem bez żadnego z tych dwóch
   mechanizmów ([`task-management.md` §7.3](domain.md#73-współbieżność-i-echo-własnej-zmiany)).
3. **Przeciąganie w kolumnę, do której przejście jest niedozwolone.** Kolumna niedostępna dla
   danej karty jest wygaszana **w chwili chwycenia karty**, na podstawie przejść ze schematu.
   Poznanie tego dopiero z błędu po upuszczeniu jest wrogie użytkownikowi.

Przejście wymagające pól (`required_fields`) otwiera modal przed potwierdzeniem ruchu — karta
wisi w stanie „w toku" do zamknięcia modala. Swimlane'y są pełnym drugim wymiarem grupowania;
przy trybie pola niestandardowego użytkownik podaje kod pola, który jest trwałą konfiguracją
tablicy.

### 2.3 Karta zgłoszenia — `/task-management/issue/:key`
**Osobna strona, nie prawy panel przy tabeli.** Powód jest praktyczny: opis, komentarze i historia
muszą dominować ekran, a link do zgłoszenia (`/issue/DEV-412`) krąży w mailach i musi otwierać
pełny widok.

Trasa idzie po **kluczu czytelnym**, nie po UUID. Stare klucze przekierowują na bieżący
(`issue.previous_keys`, [`task-management.md` §4](domain.md#4-klucz-czytelny-dev-123)) —
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
  a `<img>` nie dokłada nagłówka `Authorization` ([`multimedia.md` §3](../../guides/frontend/multimedia.md#3-miniaturki-blob-nie-adres-endpointu));
  miniatur pochodnych tu nie ma, więc adres zamawia dopiero kafelek obrazu, nie każdy wiersz;
- **usunięcie pojedynczego pliku wymaga potwierdzenia**; frontend wysyła wyłącznie komendę domenową,
  a backend usuwa bajty przez outbox i prefiks postojowy — nigdy bezpośrednim wywołaniem magazynu.

**Komentarze**, **historia** i **czas** są jednym strumieniem aktywności z filtrem
(`Wszystko / Komentarze / Historia / Czas`) i zakotwiczonym kompozytorem. Trzy rzeczy warte
zapamiętania:

- **wątek jest jednopoziomowy**, bo taka jest reguła domeny, a nie uproszczenie widoku
  ([`task-management.md` §11](domain.md#11-historia-zmian-i-komentarze));
  odpowiedź składa się w jednym przebiegu po płaskiej liście, bez rekurencji;
- **komentarz pojawia się natychmiast, przez nakładkę optymistyczną** (`ErpOptimisticStore`,
  [`optimistic-updates.md` §5](../../guides/frontend/optimistic-updates.md#5-wpięcie-b--kolekcje-dziecięce-issuechildcache)),
  a nie dopiero po dojechaniu zdarzenia z kanału `taskmgmt.issue_comment`. **To zmiana wobec
  wcześniejszej wersji tego dokumentu**, która optymistyczne wstawianie komentarzy zabraniała —
  argument („dałoby przez chwilę dwa komentarze") przestał obowiązywać, odkąd `addCommentAsync`
  respektuje uuid nadany PRZEZ KLIENTA: nakładka wstawia element pod tym samym uuidem, którym
  serwer w końcu odpowie, więc echo z serwera zastępuje wpis nakładki, a nie dubluje go;
- **zdanie w historii składa szablon, nie backend**: serwer zapisuje rodzaj wpisu, kod pola
  i surowe wartości, a nazwa pola jest kluczem tłumaczenia, więc przechodzi przez `erpTranslate`
  jako parametr drugiego `erpTranslate` (Transloco nie rozwiązuje kluczy zagnieżdżonych
  w parametrach — złożenie tego w TS wypisałoby użytkownikowi surowy klucz).

> **Autor, aktor i przypisany pokazują nazwę, nie uuid.** Wspólny katalog użytkowników
> (`ERP_USER_DIRECTORY`, [`user-directory.md`](../../guides/frontend/user-directory.md)) resolwuje
> uuid do `displayName` przez `erp-user-name`/`erp-user-avatar`; skrócony uuid pojawia się wyłącznie
> gdy katalog nie potrafi rozwiązać wpisu (np. skasowane konto Keycloak).

> **Obrazki osadzone w treści opisu są obsługiwane.** Port uploadu `erp-rich-text` rejestruje
> plik jako załącznik zgłoszenia, a renderer zamienia chronione adresy na `blob:` przy podglądzie
> i przywraca kanoniczne referencje przed zapisem. Dzięki temu obraz działa zarówno po wklejeniu,
> jak i po ponownym otwarciu edytora.

### 2.4 Backlog i planowanie sprintu — `/task-management/board/:uuid/backlog`
Podstrona tablicy scrumowej, nie osobna pozycja w menu: dwie listy obok siebie (backlog ↔ sprint),
przeciąganie między nimi, suma estymat w nagłówku sprintu.

Backlog publikujemy dopiero razem z działającą obsługą sprintów — tablica kanban jest użyteczna bez
backlogu, odwrotnie nie.

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
([`task-management.md` §10.1](domain.md#101-widoczność-liczona-po-projekcie)).

---

## 4. Grupa C — konfiguracja

### 4.1 Projekty — `/task-management/project` ✅
Lista projektów: kod, typ (`Delivery`/`Intake`), lead, liczba otwartych zgłoszeń, schemat pól,
schemat stanów.

### 4.2 Karta projektu — `/task-management/project/:uuid`
Master-detail z zakładkami: **pola** (definicje + **mapowanie na sloty**), **typy**, **tagi**,
**SLA**, **workflow**, **automatyzacje**, **webhooki** oraz **powiadomienia**. Każda zakładka
korzysta ze wspólnego nagłówka konfiguracji; jedynie feature dostarcza dane oraz komendy.

Zakładka pojawia się dopiero razem z działającym przebiegiem, który ją wypełnia — pustych
zaślepek nie publikujemy.

Formularz dodania pola niestandardowego zbiera **nazwę jako zwykły tekst** (wymaganą, z domyślnym
fallbackiem na kod pola) oraz **opcjonalny `nameKey`** — klucz tłumaczenia dla pól seedowanych,
gdzie ta sama nazwa musi wyjść po polsku i angielsku. Tabela pól wyświetla `nameKey ?? name`, więc
pole założone ręcznie bez klucza pokazuje wpisaną nazwę wprost.

Tu żyje ostrzeżenie „slot już użyty, mapowania nie zmienisz"
([`task-management.md` §6](domain.md#6-pola-niestandardowe)) — identyczne co do
treści z ostrzeżeniem przy typach dokumentów w DMS.

### 4.3 Workflow projektu
Edytor stanów i przejść działa jako zakładka konkretnego projektu, a nie niezależna trasa.
**Nie canvas grafu** — automat jest sekwencyjny, więc dwie listy
(stany, przejścia) plus macierz „z → do" są czytelniejsze i tańsze niż rysowanie
([`task-management.md` §5.4](domain.md#54-dlaczego-nie-silnik-z-dms-u)).
To świadoma różnica względem edytora obiegu w DMS, nie niedoróbka.

Publikacja zmiany otwiera **modal mapowania stanów** dla zgłoszeń siedzących w usuwanych stanach;
zatwierdzenie uruchamia zadanie masowe z postępem
([`task-management.md` §5.3](domain.md#53-zmiana-schematu-a-istniejące-zgłoszenia)).

---

## 5. Czego świadomie NIE robimy osobną stroną

| Kuszące | Dlaczego nie |
|---|---|
| „Moje zgłoszenia" | Zakres na liście. Osobna strona zmusza użytkownika do zgadywania, gdzie patrzeć |
| Strona per projekt / per dział w menu | Kontekst projektu na jednej liście — inaczej N kopii tego samego ekranu |
| Osobna lista podzadań | Hierarchia to tryb drzewa na liście zgłoszeń i pasek powiązań na karcie |
| „Uprawnienia i role" | Identity ([`identity-authz.md`](../../architecture/security.md)). Tu zostaje wyłącznie zakładka członków na karcie projektu |
| Dashboard | Bez działających wskaźników byłby zaślepką; raporty są dostępne jako osobna, uprawniona strona |
| Osobna strona sprintów | Sprint to podstrona tablicy — poza tablicą nie ma sensu |

---

## 6. Struktura katalogów i modale

Agregaty w `libs/modules/task-management/feature/src/lib/`, każdy wg
[`feature-structure.md`](../../guides/frontend/feature-structure.md) (`components`/`modal`/`page`/`translation`):

```
issue/   board/   project/   workflow-scheme/   request/
```

Modale ([`modals.md`](../../guides/frontend/modals.md)): nowe zgłoszenie, przejście stanu z wymaganymi polami,
przypisanie, dodanie powiązania (wyszukiwarka po kluczu), przeniesienie do projektu (**ostrzeżenie
o zmianie klucza**), złożenie zlecenia, odbiór zlecenia, mapowanie stanów przy publikacji schematu,
podsumowanie operacji masowej.

Definicje modali **nie wywołują** `.setProviders(...)` — providery wstrzykuje `ErpModalService`
z `getModalProviders()` kontraktu remota.

Sygnatury SignalR do orkiestratorów: `taskmgmt.issue`, `taskmgmt.board`, `taskmgmt.sprint`,
`taskmgmt.project` ([`orchestrators.md`](../../guides/frontend/orchestrators.md)).

**Osobny orkiestrator kolejności.** `BoardOrchestrator` trzyma karty po UUID i utrzymuje porządek
po `(rank, issueUuid)`; `IssueOrchestrator` trzyma treść zgłoszeń. Jeden orkiestrator na oba
zadania musiałby przeliczać porządek przy każdej zmianie tytułu.

---

## 7. Menu i uprawnienia

Każda pozycja `entry.menu.ts` dostaje `requiredPermission`, tak jak pozycje menu Catalogu.
Grupa „Konfiguracja" jest niewidoczna dla zwykłego członka zespołu.

```
Zgłoszenia                → /task-management/issue          (taskmgmt.issue.read)
Zlecenia                  → /task-management/request        (taskmgmt.issue.read)
Konfiguracja                                                 (taskmgmt.project.manage)
  └ Projekty              → /task-management/project        (taskmgmt.project.manage)
Tablice                   → /task-management/board          (taskmgmt.issue.read)
Raporty                   → /task-management/report         (taskmgmt.report.read_all)
Dokumentacja              → /task-management/documentation  (taskmgmt.issue.read)
```

Karta zgłoszenia (`/issue/:key`) i konkretna tablica (`/board/:uuid`) nie mają pozycji w menu —
wchodzi się na nie z listy. Pozycja „Tablice" prowadzi do listy tablic dostępnych użytkownikowi;
przy jednej tablicy przekierowuje wprost na nią.

---

## 8. Tłumaczenia

Zero hardcoded stringów, klucze z registry (`TASK_MANAGEMENT_KEYS.…`), `keys.ts` autogenerowany
przez `pnpm translate:keys` — nigdy ręcznie ([`translations.md`](../../guides/frontend/translations.md)).

Trzy zbiory kluczy, których nie ma w innych modułach i o które łatwo się potknąć:

- **nazwy stanów i przejść** pochodzą ze schematu (`name_key`), więc są **danymi wskazującymi na
  klucz tłumaczenia**, nie literałami w szablonie; stan zdefiniowany przez użytkownika bez klucza
  wyświetla nazwę własną — to jedyne dopuszczone wyjście poza registry;
- **nazwy pól niestandardowych** — analogicznie, z profilu projektu;
- **kody błędów przejść** (`taskmgmt.transition_not_allowed`) idą do `shared.errors.codes`
  ([`notifications.md`](../../guides/frontend/notifications.md)).

---

## 9. Układ ekranów — wzorzec YouTracka

Użytkownicy przychodzą z YouTracka i mają odnaleźć elementy tam, gdzie ich szukają
([kontrakt niefunkcjonalny](requirements.md#kryteria-niefunkcjonalne)).
Ta sekcja jest **wiążąca co do rozmieszczenia**, nie co do wyglądu — kolory, odstępy i typografia
idą z TaigaUI i Tailwinda, nie z YouTracka.

### 9.1 Karta zgłoszenia — dwie kolumny, jeden strumień

```
┌──────────────────────────────────────────────┬──────────────────────┐
│ ‹ projekt › DEV-142            [akcje: ⋯]    │  Stan  [In Progress] │
│ ⬤ Błąd  DEV-142                              │  ▸ dostępne przejścia│
│ Tytuł zgłoszenia (edycja inline)             │  ────────────────────│
│ zgłosił Anna · 2 dni temu · zm. 10 min temu  │  Przypisany   [Jan]  │
│                                              │  Priorytet  [Wysoki] │
│ ── Opis ───────────────────────────────────  │  Typ          [Błąd] │
│ treść, obrazy wklejone ze schowka            │  Termin   [12.09]    │
│                                              │  Sprint   [Sprint 17]│
│ ── Załączniki ─────────────────────────────  │  Estymata / Czas     │
│ [kafelki]                                    │  ────────────────────│
│                                              │  Pola własne         │
│ ── Powiązania ─────────────────────────────  │  (z profilu projektu)│
│ rodzic / podzadania / blokuje / realizuje    │  ────────────────────│
│                                              │  Tagi   [wms] [pilne]│
│ ── Aktywność ──────────────────────────────  │  Obserwujący         │
│ [ Wszystko | Komentarze | Historia | Czas ]  │                      │
│ …strumień chronologiczny…                    │                      │
│ ┌ pole komentarza (zakotwiczone) ──────────┐ │                      │
└──────────────────────────────────────────────┴──────────────────────┘
```

Cztery decyzje, które wynikają z tego układu:

1. **Panel pól jest po prawej i to on trzyma stan.** Stan i dostępne przejścia stoją na samej
   górze panelu, bo to najczęstsza akcja na karcie.
2. **Komentarze i historia to jeden strumień z filtrem**, nie dwie sekcje pod sobą.
   **To zmiana wobec §2.3 tego dokumentu** i jest świadoma: przy zgłoszeniu z 40 wpisami historii
   i 8 komentarzami dwie osobne sekcje zmuszają do skakania między nimi, żeby odtworzyć
   kolejność zdarzeń („zmienił stan, potem napisał dlaczego"). Filtr `Wszystko / Komentarze /
   Historia / Czas` daje jedno i drugie, a domyślnie pokazuje wszystko.
3. **Pole komentarza jest zakotwiczone na dole strumienia**, widoczne bez przewijania do końca —
   inaczej przy długim wątku odpowiedź wymaga podróży.
4. **Tytuł i opis edytuje się w miejscu**, bez trybu „edytuj całość". Karta nie ma przycisku
   „zapisz zgłoszenie" — każda zmiana to osobna komenda ([`task-management.md` §11](domain.md#11-historia-zmian-i-komentarze)).

### 9.2 Lista zgłoszeń — gdzie odchodzimy od YouTracka

YouTrack pokazuje wyniki jako **listę wierszy** (klucz, tytuł, meta pod tytułem), a nie tabelę
z kolumnami. My zostajemy przy `erp-table`:

| YouTrack | U nas | Powód |
|---|---|---|
| lista wierszy z metadanymi pod tytułem | tabela z kolumnami | kolumny pochodzą z profilu pól projektu i mają być sortowalne serwerowo ([`smart-tables.md`](../../guides/frontend/smart-tables.md)); lista wierszy to własny szablon i utrata sortowania |
| pole zapytania DSL na całą szerokość | `erp-filter` + przełączniki zakresu i projektu | DSL nie należy do bieżącego kontraktu listy |
| zapisane widoki w lewym panelu | zapisane widoki jako lista nad filtrem | lewy panel kolidowałby z menu modułu |

Zachowujemy z YouTracka: **klucz i typ jako pierwsza kolumna**, priorytet jako kolorowy znacznik
przy wierszu (nie tekst), tagi jako chipsy, zaznaczenie z paskiem akcji masowych nad tabelą.

### 9.3 Tablica

```
[ tablica ▾ ]  [ sprint ▾ ]  [ filtr ]              [ ustawienia ]
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Do zrobienia │ W toku    3/5│ Review       │ Gotowe       │
├──────────────┴──────────────┴──────────────┴──────────────┤
│ ▾ Jan Kowalski                        (swimlane)          │
│   [karta] [karta]  │ [karta]  │          │ [karta]        │
│ ▾ Bez przypisania                                         │
└───────────────────────────────────────────────────────────┘
```

Karta niesie: klucz, tytuł, znacznik typu, priorytet, tagi, estymatę i awatar przypisanego —
`BoardCardDto` niesie `TagUuids`/`EstimateMinutes` razem z nagłówkiem zgłoszenia, jednym
zapytaniem. Karta z własnym ruchem w toku (nakładka optymistyczna, jeszcze niepotwierdzona przez
serwer) jest wygaszona i nie startuje drugiego przeciągnięcia. Nagłówek kolumny: nazwa + licznik
kart + limit WIP, gdy ustawiony. Swimlane'y są zwijane.

### 9.4 Raport godzin

Układ tabeli przestawnej: wiersze = dział (projekt wykonawczy), kolumny = okres, rozwinięcie
wiersza = zagadnienia. **Rozwinięcie kończy się na poziomie zagadnienia** — niżej byłyby tytuły
zgłoszeń, do których kierownictwo nie ma dostępu
([widoczność i prywatność](requirements.md#widoczność-i-prywatność)).

---

## 10. Skąd biorą się komponenty

Reguła kolejności, obowiązująca przy każdym ekranie tego modułu:

```
1. @erp/shared/ui              — jest komponent? używamy go
2. @erp/task-management/ui     — brakuje? robimy atom/molekułę tutaj
3. własny szablon w feature    — dopiero gdy 1 i 2 nie mają sensu
```

Dostępne w `@erp/shared/ui` i wprost przydatne tutaj: `erp-table`, `erp-tabs`, `erp-tree`,
`erp-drawer`, `erp-modal`, `erp-action-toolbar`, `erp-filter`, `erp-grid-layout`,
`erp-media-preview`, `erp-empty-state`, `erp-selection-scope-banner`, `erp-rich-text`,
`erp-input-picker`, `erp-toggle-group`, `erp-confirm-dialog`.

**Brakująca zdolność komponentu współdzielonego jest dokładana do niego, nie obchodzona lokalnie.**
Przykład wiążący: wklejanie obrazów ze schowka wchodzi do `erp-rich-text`
w `@erp/shared/ui` (z portem na wgrywanie, który moduł wypełnia własnym biletem), a nie jako
lokalny handler `paste` na karcie zgłoszenia — inaczej DMS i Catalog dostaną drugą i trzecią
kopię tego samego kodu.

`libs/modules/task-management/ui` zawiera już prezentacyjne komponenty domenowe. Smart komponenty
w `feature` dostarczają im tylko modele, komendy i adaptują zdarzenia do orkiestratorów; UI nie
importuje DTO, store'ów ani serwisów danych.

| Komponent w `ui` | Zastępuje / obsługuje |
|---|---|
| `erp-issue-card` | karta na tablicy, backlogu i sprincie |
| `erp-issue-key` | klucz + ikona typu, używany w tabeli, na karcie i w powiązaniach |
| `erp-activity-stream` | strumień aktywności z filtrem (§10.1) |
| `erp-field-panel` | prawy panel pól budowany z profilu projektu |
| `erp-link-list` | pasek powiązań |
| `erp-tag-chips` | tagi na liście, karcie i kafelku |
| `erp-board-column` | kolumna kanban oraz rozciągnięta lista backlogu/sprintu; feature zostawia CDK payload i komendy |
| `erp-board-toolbar` | pasek nad tablicą: nazwa, wybór swimlane'a, link do backlogu |
| `erp-work-log-panel` | estymata z edycją inline, lista wpisów czasu, formularz dodania |
| `erp-workflow-editor` | macierz przejść „z → do" i panel edycji wybranej komórki |
| `erp-automation-rule-editor` | formularz dodania/edycji reguły automatyzacji: wyzwalacz, grupy warunków, akcje zależne od rodzaju |
| `erp-project-configuration-section` | wspólny nagłówek oraz układ zakładek konfiguracji projektu |
| `erp-issue-detail-header` | pasek kontekstu karty zgłoszenia: powrót, klucz, ograniczenie i obserwowanie |
| `erp-workflow-transition-cell` | komórka macierzy przejść: nazwa, wymagane uprawnienie i wymagane pola |
| `erp-report-pivot-label-cell` | etykieta wiersza spłaszczonej tabeli przestawnej raportu godzin: rozwijanie działu albo wcięty wiersz zagadnienia |
| `erp-project-tag-list` | katalog tagów z prezentacją edycji nazwy i scalania w kontekście wiersza |

Tabele konfiguracji i raportów (typy/pola/stany/webhooki/CSV/pivot) renderuje bezpośrednio
wspólny `erp-table` (`@erp/shared/ui`) —
moduł nie utrzymuje już własnych `erp-configuration-data-table`/`erp-report-data-table`/
`erp-report-pivot-table`.

---
