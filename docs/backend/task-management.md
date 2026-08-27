# Task Management — zgłoszenia, tablice, zlecenia międzydziałowe

**Stan: ✅ faza 0 wdrożona i zweryfikowana end-to-end; faza 1 ✅ wdrożona; fazy 2–7 📐 projekt.**
Legenda znaczników — [`architecture.md`](./architecture.md#1-stan-wdrożenia).
Mikroserwis `TaskManagement` działa (schemat `taskmgmt`, port 5290, migracja
`InitialTaskManagementSchema`) i obejmuje `Project`, `Issue`, licznik klucza czytelnego,
schemat stanów w seedzie oraz endpointy listy, karty po kluczu i zmiany stanu.
Faza 1 jest wdrożona po stronie backendu: **komentarze** (`issue_comment`, wątek
jednopoziomowy, edycja zachowująca oryginał, usunięcie miękkie) i **historia zmian**
(`issue_activity`, dopisywana jawnie w komendach, w tej samej transakcji co zmiana).
Doszły do tego **załączniki zgłoszenia** (`IssueAttachment`, migracja `IssueAttachments`, kubełek
i klucz MinIO per moduł, sygnatura `taskmgmt.issue_attachment`) oraz opis w formacie HTML
czyszczony przy zapisie (`IRichTextSanitizer`).
Front: strona `/task-management/issue` (lista serwerowa z filtrem i akcją masową) oraz karta
`/task-management/issue/:key` (opis w edytorze, przejścia stanów, załączniki, wątek komentarzy
z odpowiedziami i historia zmian); zaślepka „Dashboard Analityczny Zadań" usunięta z menu.
Nie ma jeszcze tablicy, pól niestandardowych, hierarchii ani zleceń — to fazy 2–7.
Obrazków osadzonych w treści opisu też jeszcze nie ma: backend je unosi, front wymaga podmiany
`src` na `blob:` w obie strony ([`task-management-pages.md` §2.3](../frontend/task-management-pages.md#23-karta-zgłoszenia--task-managementissuekey)).

Ten dokument opisuje **docelowy model** modułu zarządzania pracą wzorowanego na YouTracku:
projekty z własnym zestawem pól i własnym automatem stanów, tablice z ręczną kolejnością kart,
powiązania i hierarchia zgłoszeń oraz zlecenia składane działom przez biznes.
Decyzje są rozstrzygnięte — nie jest to zestaw wariantów do wyboru.

**Podział na strony, nawigacja i menu frontu →
[`docs/frontend/task-management-pages.md`](../frontend/task-management-pages.md).**

---

## 1. Po co ten moduł w tej architekturze

Catalog przetestował CRUD, operacje masowe, artefakty, realtime i uprawnienia globalne.
DMS bierze na siebie długożyjący proces, autoryzację per instancja zasobu i ingest z zewnątrz
([`dms-workflow.md`](./dms-workflow.md)). Task Management celowo **nie powtarza** tamtych
wyzwań — bierze cztery, których nie ma dziś nigdzie:

| Wyzwanie | Stan | Gdzie w tym dokumencie |
|---|---|---|
| **Uporządkowana kolekcja** — ręczna kolejność kart, przestawiana przez drag&drop | 📐 wszystkie listy sortują się po kolumnie | [§7](#7-kolejność-na-tablicy) |
| **Współbieżna edycja tej samej kolekcji** — dwie osoby przestawiają karty w tej samej chwili | 📐 realtime dziś tylko odświeża cache | [§7.3](#73-współbieżność-i-echo-własnej-zmiany) |
| **Konfiguracja per projekt** — inny zestaw pól i inny automat stanów w każdym projekcie | 📐 | [§5](#5-automat-stanów-jako-dana), [§6](#6-pola-niestandardowe) |
| **Graf między encjami tego samego agregatu** — hierarchia i powiązania, z wykrywaniem cykli | 🟡 jest precedens: `RoleGraphCycleRule` w Identity | [§8](#8-hierarchia-i-powiązania) |
| **Zlecenie przechodzące przez granicę działu** z terminem i odbiorem | 📐 | [§9](#9-zlecenia-międzydziałowe) |

Wszystko poza tym (CQRS, outbox, `job`/`job_item`, SignalR, `ProblemDetails`, idempotencja
`X-Request-Id`, walidacja wsadowa) jest **ponownym użyciem** — nie piszemy nowej infrastruktury.

### 1.1 Czego ten moduł świadomie nie testuje

Żeby zakres nie spuchł do drugiego DMS-u:

- **nie ma silnika obiegu na tokenach** — automat stanów jest sekwencyjny, jeden stan naraz
  ([§5.4](#54-dlaczego-nie-silnik-z-dms-u));
- **nie ma materializowanego ACL per zgłoszenie** — widoczność liczy się po projekcie
  ([§10](#10-widoczność-i-uprawnienia));
- **nie ma harmonogramu per encja** — terminy obsługuje cykliczny skan
  ([§9.3](#93-terminy-i-eskalacje));
- **nie ma ingestu z zewnątrz ani archiwizacji z hashem** — to domena DMS-u.

---

## 2. Nazewnictwo — `Issue`, nigdy `Task`

Słowo „zadanie" jest w tym systemie zajęte **trzykrotnie**: `job`/`job_item` to operacje masowe,
„zadania" w UI to historia zadań z Notification (dzwonek), a `WorkItem` to czynność obiegu w DMS.
Dlatego:

| Pojęcie | Nazwa w kodzie | Nazwa w UI (PL) |
|---|---|---|
| Jednostka pracy w tym module | `Issue` | „zgłoszenie" |
| Kontener zgłoszeń, właściciel konfiguracji | `Project` | „projekt" |
| Tablica z kolumnami i kolejnością | `Board` | „tablica" |
| Iteracja | `Sprint` | „sprint" |

**Zakaz:** `Task`, `Job`, `WorkItem` jako typy w `TaskManagement.Domain`. Katalog modułu w repo
zostaje `task-management` (jest już założony w NX), ale prefiksy techniczne to **`taskmgmt`**:

- schemat bazy: `taskmgmt`,
- sygnatury SignalR: `taskmgmt.issue`, `taskmgmt.board`, `taskmgmt.project`, `taskmgmt.sprint`,
- kody uprawnień: `taskmgmt.issue.read`, `taskmgmt.project.manage`…

Prefiks `task.` odpada, bo `Jobs`/`notification.job` już zajmują to pole semantyczne i przy
czytaniu logów nie dałoby się ich rozróżnić.

**Port HTTP dev: 5290** (kolejny wolny po `identity` 5280). Front: 4205 (już przydzielony).

---

## 3. Agregaty

Schemat `taskmgmt`, jeden mikroserwis `TaskManagement` (4 projekty Clean Architecture,
[`new-microservice.md`](./new-microservice.md)).

### `Project`
Właściciel konfiguracji: kod (`DEV`, `MKT`), nazwa, zespół, **schemat pól**, **schemat stanów**,
domyślna tablica, licznik klucza. Projekt jest granicą widoczności i granicą numeracji.

Rozróżnienie, które musi być w modelu od początku: `Project.kind ∈ { Delivery | Intake }`.
`Delivery` to projekt wykonawczy (dział dev ma swoją tablicę i sprinty), `Intake` to rejestr
zleceń działu zamawiającego. Ten sam agregat, inny domyślny schemat stanów i inne domyślne
uprawnienia — nie dwa typy w kodzie ([§9](#9-zlecenia-międzydziałowe)).

### `Issue`
Jedno zgłoszenie: klucz czytelny (`DEV-123`), tytuł, opis, typ, priorytet, stan, zgłaszający,
przypisany, termin, wartości pól niestandardowych, rodzic, obserwujący.

**Wyniki pracy (komentarze, historia zmian, praca zalogowana) wiszą przy zgłoszeniu, nie przy
tablicy.** Zgłoszenie może wejść na drugą tablicę albo z niej wypaść i niczego to nie gubi.

### `Board`
Tablica: filtr określający, które zgłoszenia na nią wpadają (projekt/y + warunek), kolumny
mapowane na stany, swimlane'y, tryb (`Kanban | Scrum`). Kolejność kart to tabela podrzędna
([§7](#7-kolejność-na-tablicy)).

### `Sprint`
Iteracja jednej tablicy scrumowej: nazwa, zakres dat, stan (`Planned | Active | Closed`).
Zamknięcie sprintu z niedokończonymi zgłoszeniami **przenosi je do backlogu albo do następnego
sprintu — jawną decyzją użytkownika, nigdy domyślnie**; ciche przeniesienie sprawia, że nikt
nie ufa raportowi z iteracji.

### Niezmienniki międzyagregatowe
- **Klucz zgłoszenia jest unikalny globalnie**: `unique (key)` na `issue`, generowany
  z licznika projektu ([§4](#4-klucz-czytelny-dev-123)).
- **Jedno zgłoszenie ma najwyżej jedną kartę na danej tablicy**: `unique (board_uuid, issue_uuid)`
  na `board_card`.
- **Aktywny sprint na tablicy jest najwyżej jeden**: `unique (board_uuid) where status = 'Active'`.

Wszystkie trzy egzekwuje **indeks bazy, nie kod aplikacji** — dokładnie jak niezmiennik
„dokument w jednym obiegu" w DMS.

---

## 4. Klucz czytelny `DEV-123`

Użytkownik mówi „zrób DEV-412", nie UUID-em. Klucz to **numer kolejny w obrębie projektu**, więc
jest jedynym miejscem w architekturze, gdzie potrzebna jest monotoniczna sekwencja per encja.

```
project_key_counter(project_uuid pk, prefix, next_number)
```

Nadanie numeru to jedno zdanie w **tej samej transakcji**, co zapis zgłoszenia:

```sql
UPDATE taskmgmt.project_key_counter
   SET next_number = next_number + 1
 WHERE project_uuid = @p
RETURNING next_number;
```

Dlaczego akurat tak, przy dwóch instancjach:

| Wariant | Dlaczego odpadł |
|---|---|
| `MAX(number) + 1` przy wstawianiu | Klasyczny wyścig — dwie instancje wyliczą ten sam numer, druga dostanie błąd unikalności |
| Sekwencja Postgresa per projekt (`CREATE SEQUENCE`) | Nowy projekt = DDL w runtime; poza tym sekwencja nie cofa się przy rollbacku, więc numeracja dziurawi się przy każdej odrzuconej walidacji |
| Licznik w pamięci procesu | Wywraca się przy drugiej instancji — dokładnie ten zakaz, co w [`multi-instance.md`](./multi-instance.md) |

`UPDATE … RETURNING` blokuje wiersz licznika na czas transakcji, więc przy dużym natężeniu
tworzenia zgłoszeń w jednym projekcie **serializuje** je. To akceptowalne: tworzenie zgłoszenia
jest operacją ludzką. Operacja masowa „utwórz 500 zgłoszeń z importu" bierze numery **jednym
`UPDATE … SET next_number = next_number + @n`** i rozdaje z zakresu — jeden chunk `job_item` to
jeden przeskok licznika.

**Zmiana prefiksu projektu nie przenumerowuje istniejących zgłoszeń.** Stare klucze zostają
(linki w mailach i commitach muszą działać), a `issue.key` jest kolumną, nie wyrażeniem.
Przeniesienie zgłoszenia do innego projektu nadaje **nowy klucz** i zapisuje stary w
`issue.previous_keys` — po tej kolumnie działa wyszukiwanie, inaczej „DEV-412" przestaje cokolwiek
znajdować dzień po przeniesieniu.

---

## 5. Automat stanów jako dana

### 5.1 `WorkflowScheme`
Każdy projekt wskazuje schemat stanów; schemat to **dana, nie klasa**:

```
workflow_scheme(uuid pk, name, is_system)
workflow_state(uuid pk, scheme_uuid, code, name_key, category, order_no)
workflow_transition(uuid pk, scheme_uuid, from_state, to_state,
                    name_key, required_permission, required_fields jsonb, guard jsonb)
```

`state.category ∈ { Todo | InProgress | Done }` — kategoria, nie nazwa stanu, jest tym, po czym
liczą raporty i po czym tablica wie, że karta „wyszła z pracy". Dzięki temu projekt może mieć
stan „Czeka na zamówienie sprzętu" i nadal poprawnie liczyć czas realizacji.

Nowy projekt z własnym zestawem stanów **nie wymaga wdrożenia kodu**.

### 5.2 Reguły przejścia
Na przejściu wiszą trzy rzeczy i wszystkie są danymi:

- `required_permission` — kto może wykonać przejście,
- `required_fields` — czego nie wolno zostawić pustego (przejście do `Done` bez `resolution` jest
  najczęstszym źródłem śmieci w raportach),
- `guard` — warunek na polach zgłoszenia, w **tym samym wąskim języku warunków**, co krawędzie
  gateway w DMS ([`dms-workflow.md` §4.4](./dms-workflow.md#44-warunki-na-krawędziach)):
  porównania, `and`/`or`, ścieżka do pola, literały. Wyrażeń ogólnego przeznaczenia
  wykonywanych z bazy nie ma i nie będzie.

Przejście nieopisane w schemacie **nie istnieje** — komenda `setIssueState` odrzuca je błędem
`taskmgmt.transition_not_allowed`, nie zapisuje.

### 5.3 Zmiana schematu a istniejące zgłoszenia
DMS zamraża definicję w snapshocie instancji. **Tutaj jest odwrotnie i to jest decyzja, nie
przeoczenie:** zgłoszenia zawsze czytają bieżący schemat.

Powód: tablica pokazuje kilkaset zgłoszeń jednocześnie, w kolumnach wyprowadzonych ze stanów.
Gdyby połowa kart żyła na starej wersji schematu, tablica musiałaby renderować kolumny, których
w konfiguracji już nie ma — a użytkownik widzi jeden ekran, nie jeden proces.

Ceną jest **migracja stanów przy publikacji schematu**: usunięcie stanu wymaga wskazania stanu
docelowego dla zgłoszeń, które w nim siedzą. Wykonuje ją istniejący mechanizm `job`/`job_item`
z sukcesem częściowym ([`bulk-commands.md`](./bulk-commands.md)) — bez nowego kodu, z widocznym
postępem. Publikacja bez pełnego mapowania jest odrzucana walidacją, nie kończy się cichym
osieroceniem zgłoszeń.

### 5.4 Dlaczego nie silnik z DMS-u
Zgłoszenie jest w **dokładnie jednym stanie** — to niezmiennik, na którym stoi cała tablica
(karta leży w jednej kolumnie). Silnik z tokenami dopuszcza dwa aktywne węzły naraz, więc
w modelu tablicy nie ma dla niego miejsca. Do tego zgłoszenie żyje dni, nie tygodnie, i wraca
w tył (`Done → In Progress`) rutynowo, a nie jako sterowana wyjątkiem operacja `workflow.return`.

Gdy trzeci moduł faktycznie zażąda grafu z rozgałęzieniami, powstaje
`Erp.BuildingBlocks.Workflow` jako **biblioteka** — tak jak zapowiada
[`dms-workflow.md` §12.5](./dms-workflow.md#125-silnik-obiegu-zostaje-w-dms). Dwa różne mechanizmy
w dwóch modułach są tu tańsze niż przedwczesna abstrakcja nad jednym.

---

## 6. Pola niestandardowe

Każdy projekt ma inny zestaw pól (dev chce `Component` i `Fix Version`, marketing `Kanał`
i `Budżet`). Model jest **ten sam, co dla typu dokumentu w DMS** i celowo się od niego nie różni:

- źródłem prawdy jest `issue.custom_fields` (jsonb), walidowany schematem projektu przy zapisie;
- pola **sortowalne i filtrowalne** dublują się w stałej puli slotów `num_1..num_4`,
  `text_1..text_4`, `date_1..date_4`, `user_1..user_2`;
- `FieldScheme` mapuje nazwę pola na slot, mapowanie jest **niezmienne po pierwszym użyciu**;
- indeksy częściowe per projekt: `create index … on issue (num_1) where project_uuid = :dev`.

Uzasadnienie wyboru slotów (i odrzucenia indeksów wyrażeniowych, tabel projekcji per typ oraz
EAV) jest wspólne i nie powtarzamy go —
[`dms-workflow.md` §3.2](./dms-workflow.md#32-sortowalne-atrybuty--sloty-typowane).

`user_1..user_2` to jedyne rozszerzenie względem DMS: „Reviewer", „Product Owner" i „QA" to
w praktyce najczęstsze pola niestandardowe w narzędziu tego typu, a filtrowanie po nich
(„wszystko, gdzie jestem recenzentem") musi być joinem w SQL.

**Profil pól jedzie do frontu endpointem `getProjectFieldProfile`** — klucz, klucz tłumaczenia,
typ danych, sortowalność, filtrowalność, słownik wartości. Whitelist sortowania po stronie
backendu to kolumny wspólne `issue` + sloty aktywnego projektu; oba końce czytają z tego samego
profilu, więc nie da się ich rozjechać ([`cqrs.md`](./cqrs.md)).

> **Kiedy wydzielić wzorzec do building-blocks.** Sloty + profil pól to teraz **drugie**
> zastosowanie. Wydzielamy `Erp.BuildingBlocks.CustomFields` przy **trzecim**, nie wcześniej —
> dwa użycia nie pokazują jeszcze, co w tym wzorcu jest wspólne, a co domenowe.

---

## 7. Kolejność na tablicy

To jest główny sprawdzian tego modułu. Żadna dzisiejsza lista w systemie nie ma kolejności
ustawianej ręcznie przez użytkownika.

### 7.1 Gdzie mieszka kolejność

```
board_card(board_uuid, issue_uuid, rank text, sprint_uuid null, updated_at)
primary key (board_uuid, issue_uuid)
index (board_uuid, rank)
```

Kolejność należy do **tablicy**, nie do zgłoszenia — to samo zgłoszenie może wisieć na tablicy
działu dev (wysoko) i na tablicy zarządu (nisko). Kolumna, w której leży karta, **nie jest
przechowywana** — wynika ze stanu zgłoszenia i mapowania kolumn tablicy. Duplikowanie jej
w `board_card` dawałoby dwa źródła prawdy rozjeżdżające się przy każdej zmianie stanu spoza
tablicy.

### 7.2 `rank` jest łańcuchem, nie liczbą całkowitą

Pozycja jako `int` z przenumerowaniem wymaga przy każdym przeciągnięciu karty `UPDATE` na
kilkudziesięciu wierszach — a więc długiej transakcji, kolizji z drugą osobą przestawiającą
karty i burzy zdarzeń realtime.

`rank` to **łańcuch porządkowany leksykograficznie** (indeksowanie ułamkowe: między `"n"` a `"o"`
wstawia się `"nn"`). Przeciągnięcie karty to **jeden `UPDATE` jednego wiersza** — reszta tablicy
nietknięta.

Komenda **nie przyjmuje wyliczonego ranku**, tylko sąsiadów:

```
setBoardCardPosition { boardUuid, issueUuid, afterIssueUuid?, beforeIssueUuid? }
```

Rank liczy serwer, w transakcji, z bieżących wartości sąsiadów. Gdyby liczył go klient, każde
przestawienie na nieaktualnym widoku wstawiałoby kartę w miejsce, którego użytkownik nie widział.

**Rebalans**: łańcuchy rosną przy wielokrotnym wstawianiu w to samo miejsce. Usługa tła
przenumerowuje tablicę, gdy najdłuższy rank przekroczy próg — oznaczona `[ClusterSafe]`
z dzierżawą na advisory locku, jak każda usługa cykliczna
([`multi-instance.md` §4.3](./multi-instance.md#43-usługi-cykliczne--dzierżawa-z-fazy-0)).
Bez `[ClusterSafe]` nie przejdzie `BackgroundServiceTests`.

### 7.3 Współbieżność i echo własnej zmiany

Dwie osoby wstawiające kartę **w to samo miejsce** wyliczą identyczny rank. To **nie jest błąd** —
porządek rozstrzyga para `(rank, issue_uuid)`, więc kolejność jest deterministyczna i jednakowa
u obu. Odrzucanie takiej operacji błędem współbieżności byłoby wrogie: obie osoby zrobiły coś
sensownego.

Kolizja realna to co innego: **ktoś przeciągnął kartę, którą ktoś inny właśnie usunął z tablicy
albo przeniósł do innego projektu**. Tu obowiązuje optymistyczna kontrola po wersji zgłoszenia —
komenda odpada z `409`, front cofa optymistyczny ruch i pokazuje toast.

Echo: `AggregateChanged` niesie `CorrelationId`
([`AggregateChanged.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/AggregateChanged.cs)),
a front wysyła `X-Request-Id` przy każdej komendzie. **Front pomija zdarzenie o korelacji
odpowiadającej własnej, jeszcze niepotwierdzonej komendzie** — inaczej karta pod kursorem
przeskakuje w trakcie przeciągania, bo przyszło echo własnego ruchu.

### 7.4 Realtime
Sygnatury: `taskmgmt.issue`, `taskmgmt.board`, `taskmgmt.sprint`, `taskmgmt.project`.
Rejestracja w `AggregateSignatures` musi zgadzać się co do znaku z `signalrSignature`
orkiestratorów ([`realtime-signalr.md`](./realtime-signalr.md)).

Zmiana kolejności rozgłasza się na `taskmgmt.board` z uuid **karty przestawionej i jej sąsiadów** —
nie całej tablicy. Porządkowanie po stronie klienta jest lokalne, więc trzy uuid-y wystarczą.
Przy migracji stanów albo rebalansie idzie `BulkChanged` (unieważnienie sygnatury), bo wysłanie
kilkuset uuid-ów przez WebSocket jest dokładnie tym, przed czym chroni próg w Notification.

---

## 8. Hierarchia i powiązania

### 8.1 Dwie różne rzeczy
- **Hierarchia** — `issue.parent_uuid`, drzewo epik → zadanie → podzadanie. Jeden rodzic.
- **Powiązanie** — `issue_link(source_uuid, target_uuid, type)`, graf. Typy: `blokuje/blokowane`,
  `duplikuje`, `dotyczy`, `realizuje` (typ zarezerwowany dla zleceń, [§9](#9-zlecenia-międzydziałowe)).

Trzymanie obu w jednej tabeli („rodzic to link typu `subtask`") kusi, ale rodzic ma inne reguły
niż link: wpływa na agregację postępu, na widok drzewa i na zamykanie. Jedna tabela znaczy
`WHERE type = 'subtask'` w każdym z tych zapytań i brak indeksu, który by je obsłużył.

### 8.2 Cykle
Zarówno drzewo, jak i `blokuje` muszą być acykliczne. Sprawdzenie to **reguła wsadowa**
`IssueLinkCycleRule : IBatchRule<T>` — bezpośredni odpowiednik `RoleGraphCycleRule` z Identity
([`batch-validation.md`](./batch-validation.md)), rejestrowana skanem zestawów, bez `AddScoped`
w `Program.cs`. Sprawdzenie idzie **rekurencyjnym CTE w bazie**, nie wczytaniem grafu do pamięci:
graf zależności w dużym projekcie potrafi mieć tysiące krawędzi, a reguła musi działać także
w pre-checku operacji masowej.

### 8.3 Reguły domenowe wokół hierarchii
- Zamknięcie rodzica z otwartymi dziećmi — **ostrzeżenie konfigurowalne per projekt**, nie twarda
  blokada. Twarda blokada w narzędziu tego typu jest obchodzona kasowaniem podzadań.
- Przeniesienie rodzica do innego projektu **przenosi dzieci**; klucz każdego z nich zmienia się
  wg [§4](#4-klucz-czytelny-dev-123). To operacja masowa, bo zgłoszeń może być kilkadziesiąt.
- Zgłoszenie zablokowane (`blokowane przez` w stanie nie-`Done`) może zmienić stan, ale przejście
  wymaga potwierdzenia — reguła jest ostrzeżeniem walidacyjnym, nie `guard`em.

---

## 9. Zlecenia międzydziałowe

Sedno wymagania: **biznes zleca pracę działowi dev, dział dev prowadzi swoje własne zadania,
i musi dać się je połączyć.**

### 9.1 Model: dwa zgłoszenia, jedno powiązanie
Zlecenie jest **zwykłym `Issue`** w projekcie typu `Intake` należącym do działu zamawiającego.
Realizacja to **osobne zgłoszenie** (albo kilka) w projekcie `Delivery` działu dev, powiązane
linkiem `realizuje`.

Dlaczego nie jedno zgłoszenie przekazywane między projektami:

| Wariant | Dlaczego odpadł |
|---|---|
| To samo zgłoszenie zmienia projekt | Zamawiający i wykonawca mają **różne cykle życia i różne terminy**. „Zaakceptowane do realizacji" u biznesu i „W code review" u devów to dwie prawdy jednocześnie — jeden stan nie udźwignie obu |
| Osobny agregat `ServiceRequest` | Ten sam zestaw pól, komentarzy, historii, obserwujących i tablic. Drugi agregat to drugi komplet endpointów, orkiestratorów i ekranów, żeby dostać jedno pole różnicy |
| Zlecenie jako epik z podzadaniami | Hierarchia jest wewnątrz projektu i steruje postępem. Zlecenie i realizacja są **równorzędne** i należą do różnych właścicieli |

Jedno zlecenie może być realizowane przez kilka zgłoszeń w kilku projektach — link jest relacją
wiele-do-wielu, więc wychodzi to bez żadnej zmiany modelu.

### 9.2 Postęp bez ręcznego przepisywania
Zamykanie zgłoszenia w `Delivery` publikuje **zdarzenie domenowe** (ten sam moduł, więc nie
integracyjne), a nasłuch przelicza pole `derived_delivery_state` na powiązanym zleceniu.
Zamawiający widzi postęp bez zaglądania na cudzą tablicę i **bez prawa zapisu** w projekcie dev.

**Przejścia stanu zlecenia nie robi automat.** Odbiór („zrealizowane zgodnie z zamówieniem")
jest decyzją człowieka po stronie biznesu — przejściem w schemacie projektu `Intake`, z
`required_permission`. Automatyczne zamykanie zleceń po zamknięciu zadania dev znosi cały sens
odbioru.

### 9.3 Terminy i eskalacje
`issue.due_at` + `sla_policy` na projekcie (czas reakcji, czas realizacji, liczony po kalendarzu
roboczym). Przekroczenie terminu i przypomnienia obsługuje **usługa cykliczna skanująca po
indeksie `(due_at) where state_category <> 'Done'`**, oznaczona `[ClusterSafe]`, z dzierżawą
z fazy 0.

Świadoma różnica wobec DMS: tam terminy idą przez `workflow_scheduled_work` z `SKIP LOCKED`, bo
timer obiegu może wypaść o 14:03 i musi być pojedynczy. Tutaj rozdzielczość jest **dzienna**,
a skan po indeksie jest tańszy niż utrzymywanie wpisu harmonogramu per zgłoszenie —
wprowadzanie drugiej instancji tamtego mechanizmu bez potrzeby byłoby kosztem bez zysku.

Samo powiadomienie: moduł **publikuje `UserNotificationRequested`** i sam wylicza odbiorców
(tylko on zna obserwujących), a doręczenie, grupowanie i preferencje należą do Notification —
[`user-notifications.md`](./user-notifications.md). Wysyłka nie rozłazi się po modułach.

---

## 10. Widoczność i uprawnienia

### 10.1 Widoczność liczona po projekcie
```
project_member(project_uuid, user_uuid, role)   -- Viewer | Contributor | Lead
```

Filtr listy to `project_uuid IN (select … from project_member where user_uuid = @me)` plus
projekty publiczne w organizacji. To **join w SQL**, więc serwerowa paginacja i sortowanie
działają — a to jest ten sam wymóg, który w DMS wymusił materializowany `document_acl`.

Materializowanego ACL per zgłoszenie **tu nie ma**, bo liczba projektów jest o rzędy wielkości
mniejsza niż liczba dokumentów, a dostęp nie zmienia się przy każdym kroku procesu. Wyjątki od
widoczności projektowej są dwa i oba są wąskie:

- **zgłoszenie prywatne** (`is_restricted`) — widoczne dla zgłaszającego, przypisanego,
  obserwujących i `Lead`; kolumna na `issue`, jeden warunek w predykacie;
- **wgląd z powiązania** — zamawiający widzi **nagłówek** (klucz, tytuł, stan, przypisany)
  powiązanego zgłoszenia dev bez członkostwa w tamtym projekcie. Nagłówek, nie opis
  i nie komentarze.

Gdyby wyjątków przybyło ponad te dwa, właściwą odpowiedzią jest przejście na materializowany ACL
wzorem DMS — nie dokładanie kolejnych warunków do predykatu.

### 10.2 Uprawnienia funkcyjne
Kody w `Permissions.cs` wg konwencji z [`identity-authz.md`](./identity-authz.md):
`taskmgmt.issue.read`, `taskmgmt.issue.create`, `taskmgmt.issue.update`, `taskmgmt.issue.bulk`,
`taskmgmt.board.manage`, `taskmgmt.project.manage`, `taskmgmt.scheme.manage`.
Kopia katalogu po stronie frontu w `permission-codes.ts` — dopisanie kodu w jednym miejscu
wymaga dopisania w drugim.

**Rola w projekcie ≠ uprawnienie w Identity.** Identity odpowiada „czy w ogóle wolno ci ruszać
zgłoszenia", `project_member.role` — „w których projektach". To dokładnie ten podział, który
[`identity-authz.md` §9](./identity-authz.md) opisuje jako **atrybut nadania, nigdy osobny kod
uprawnienia** — inaczej katalog uprawnień rośnie z liczbą projektów.

### 10.3 Struktura organizacyjna — czego tu nie ma
„Dział" nie jest bytem w tym module. `Project` ma właściciela i członków; dopóki Identity nie
dostanie jednostek organizacyjnych (dziś: pozycja odłożona, `identity-authz.md` §9), dział
**jest** projektem i jego zespołem. Nie budujemy w `taskmgmt` drugiej hierarchii firmy — gdy
Identity dostanie jednostki, `project.owner_unit_id` wskaże na nie i nic więcej się nie zmieni.

---

## 11. Historia zmian i komentarze

```
issue_activity(uuid pk, issue_uuid, occurred_at, actor_id, kind,
               field_code, old_value, new_value, correlation_id)
```

Append-only, zapisywany **w tej samej transakcji** co zmiana. To nie jest to samo, co
`AggregateChanged` ze skanu ChangeTrackera: tamto mówi „coś się zmieniło" na potrzeby cache'u,
a to jest **treść zmiany pole po polu**, pokazywana użytkownikowi na karcie zgłoszenia.
Automatyczny skan nie zna znaczenia pól niestandardowych ani nie odróżnia zmiany istotnej od
technicznej, więc zapis jest jawny — w komendzie, nie w infrastrukturze.

Komentarze to osobna tabela z wątkowaniem jednopoziomowym i wzmiankami (`@user`), które
generują zdarzenie → Notification. Edycja komentarza zachowuje poprzednią treść (przy sporze
„ale on to napisał" liczy się oryginał).

Praca zalogowana (`work_log`) — jedna tabela, agregowana do rodzica. Wchodzi w późnej fazie
i **nie jest** systemem czasu pracy; granica z kadrami jest tu tak samo twarda, jak granica
DMS-u z księgowością.

---

## 12. Operacje masowe

Wpadają w istniejący kontrakt bez nowego mechanizmu — `BatchCommand<T,TFilter>` → `BatchResult`
→ `job`/`job_item` z sukcesem częściowym ([`bulk-commands.md`](./bulk-commands.md)):

| Operacja | Reguły wstępne (`IBatchRule<T>`) |
|---|---|
| Zmiana stanu wielu zgłoszeń | Przejście dozwolone w schemacie, uprawnienie na przejściu, pola wymagane wypełnione |
| Przypisanie / zmiana priorytetu / dodanie do sprintu | Członkostwo w projekcie, sprint aktywny lub planowany |
| Przeniesienie do innego projektu | Zgodność schematu pól, mapowanie stanów, nadanie nowych kluczy |
| Migracja stanów po publikacji schematu ([§5.3](#53-zmiana-schematu-a-istniejące-zgłoszenia)) | Kompletność mapowania |

Reguła „metoda agregatu waliduje **przed** zmianą stanu" obowiązuje jak wszędzie — na tym stoi
częściowy sukces.

---

## 13. Kolejność wdrożenia

| Faza | Zakres | Co weryfikuje |
|---|---|---|
| 0 | Mikroserwis `TaskManagement`, schemat `taskmgmt`, `Project` + `Issue`, licznik klucza, lista serwerowa, karta zgłoszenia, przepisanie szkieletu frontu | Szablon modułu na nowej domenie + **sekwencja per encja przy dwóch instancjach** |
| 1 | `WorkflowScheme` w seedzie, przejścia z regułami, komentarze, `issue_activity` | Automat stanów jako dana |
| 2 | `Board` + `board_card` + `rank`, drag&drop, realtime kolejności, rebalans `[ClusterSafe]` | **Uporządkowana kolekcja i współbieżna edycja — główne pytanie modułu** |
| 3 | `FieldScheme`, sloty, `getProjectFieldProfile`, kolumny i filtry z profilu | Konfiguracja per projekt |
| 4 | Hierarchia, `issue_link`, `IssueLinkCycleRule`, widok drzewa | Graf w obrębie agregatu |
| 5 | Projekty `Intake`, link `realizuje`, `derived_delivery_state`, odbiór, SLA i eskalacje | Zlecenia przez granicę działu |
| 6 | Sprinty, backlog, zamknięcie iteracji, operacje masowe na zgłoszeniach | Dojrzałość narzędzia |
| 7 | Edytor schematu stanów, migracja stanów przy publikacji, zapisane widoki, `work_log` | Konfiguracja z UI, nie z seeda |

Faza 2 sama odpowiada na główne pytanie architektoniczne. Fazy 0–1 to fundament, reszta jest
rozbudową.
Które strony frontu wchodzą w której fazie →
[`task-management-pages.md` §9](../frontend/task-management-pages.md#9-kolejność-względem-faz-wdrożenia).

---

## 14. Granice modułu — czego tu nie ma

| Kuszące | Właściciel / dlaczego nie |
|---|---|
| Obieg dokumentu (akceptacja faktury) | DMS. Zgłoszenie to praca do wykonania, dokument to rzecz do zatwierdzenia — inne cykle życia, inny reżim audytu |
| Repozytorium kodu, PR-y, CI | Zewnętrzne narzędzie. Wchodzi jako **link zewnętrzny na zgłoszeniu**, nigdy jako integracja w `TaskManagement.Domain` |
| System czasu pracy, urlopy, grafiki | Kadry. `work_log` służy szacowaniu pracy w projekcie, nie rozliczaniu pracownika |
| Wiki / baza wiedzy | Osobna domena. Opis zgłoszenia to nie dokumentacja |
| Silnik obiegu ogólnego przeznaczenia | [§5.4](#54-dlaczego-nie-silnik-z-dms-u) — biblioteka `Erp.BuildingBlocks.Workflow` przy trzecim odbiorcy, nie mikroserwis |
| Powiadomienia e-mail / push, skrzynka użytkownika | Notification ([`user-notifications.md`](./user-notifications.md)). Ten moduł publikuje `UserNotificationRequested` z listą odbiorców i nic poza tym |
| Uprawnienia i role | Identity. Tu zostaje wyłącznie `project_member` jako atrybut nadania ([§10.2](#102-uprawnienia-funkcyjne)) |
| Dashboard analityczny / raporty burndown | Po fazie 6, gdy są dane. Zrobiony pierwszy, przez pół roku świeci pustkami — i to jest dokładnie treść dzisiejszej zaślepki w menu |

---

## 15. Zobacz też

- [`architecture.md`](./architecture.md) — stan wdrożenia, granice warstw, reguły DI
- [`new-microservice.md`](./new-microservice.md) — jak założyć mikroserwis `TaskManagement`
- [`dms-workflow.md`](./dms-workflow.md) — sloty sortowalne, język warunków, silnik obiegu
- [`bulk-commands.md`](./bulk-commands.md), [`batch-validation.md`](./batch-validation.md)
- [`multi-instance.md`](./multi-instance.md) — `[ClusterSafe]`, dzierżawy, backplane
- [`realtime-signalr.md`](./realtime-signalr.md) — sygnatury, koalescencja, resync
- [`identity-authz.md`](./identity-authz.md) — kody uprawnień, atrybut nadania
- [`user-notifications.md`](./user-notifications.md) — dokąd trafia „nowy komentarz" i „zlecenie zrealizowane"
- [`task-management-pages.md`](../frontend/task-management-pages.md) — strony i menu
