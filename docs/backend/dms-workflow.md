# DMS — dokumenty i obiegi

**Stan: 📐 projekt, brak kodu.** Legenda znaczników — [`architecture.md`](./architecture.md#1-stan-wdrożenia).
Front DMS to dziś atrapa (`MOCK_DOCUMENTS` w `libs/modules/dms/feature`), backendu `Dms` nie ma.

Ten dokument opisuje **docelowy model** modułu obiegu dokumentów: agregaty, silnik obiegu,
dostęp per dokument, wejście dokumentów z zewnątrz, archiwizację i kontrakt listy dla frontu.
Decyzje są rozstrzygnięte — nie jest to zestaw wariantów do wyboru.

**Podział na strony, nawigacja i menu frontu → [`docs/frontend/dms-pages.md`](../frontend/dms-pages.md).**

---

## 1. Po co ten moduł w tej architekturze

Catalog przetestował CRUD, operacje masowe, artefakty, realtime i uprawnienia globalne.
DMS jest testem **siedmiu rzeczy, których architektura jeszcze nie robi**:

| Wyzwanie | Stan | Gdzie w tym dokumencie |
|---|---|---|
| Długożyjący proces stanowy (instancja obiegu żyje tygodniami) | 📐 brak odpowiednika | [§5](#5-silnik-obiegu) |
| Czas jako wyzwalacz — terminy, eskalacje, przypomnienia per encja | 📐 są tylko usługi cykliczne | [§5.3](#53-praca-odroczona-w-czasie) |
| Autoryzacja na poziomie **instancji zasobu** | 📐 Identity ma tylko uprawnienia globalne | [§6](#6-dostęp-do-dokumentu) |
| Konfiguracja jako dane — graf rysowany przez użytkownika, walidowany, wersjonowany | 📐 | [§4](#4-szablon-obiegu) |
| Snapshot definicji — instancja niezależna od bieżącego szablonu | 📐 | [§4.2](#42-snapshot-w-instancji) |
| Formularze definiowane danymi (każdy krok ma inne pola) | 📐 | [§9.4](#94-formularze-z-definicji) |
| Artefakt archiwalny — niezmienny, z hashem, retencja latami | 📐 rozszerzenie [`exports-artifacts.md`](./exports-artifacts.md) | [§8](#8-audyt-i-archiwizacja) |

Wszystko poza tym (CQRS, outbox, `job`/`job_item`, MinIO, SignalR, `ProblemDetails`,
idempotencja `X-Request-Id`) jest **ponownym użyciem** istniejących mechanizmów, nie nowym kodem
infrastrukturalnym.

---

## 2. Agregaty

Cztery agregaty w schemacie `dms`, jeden mikroserwis `Dms` (4 projekty Clean Architecture,
patrz [`new-microservice.md`](./new-microservice.md)).

### `Document`
Tożsamość dokumentu: typ, metadane, plik główny (wersjonowany), załączniki, klasa poufności,
jednostka organizacyjna, status życia (`Draft | Active | Archived`).

**Wyniki kroków obiegu (opis merytoryczny, dekretacja, decyzje) zapisują się na dokumencie,
nie w instancji obiegu.** To przesądza o kilku rzeczach naraz: przekierowanie na inny obieg
i cofnięcie niczego nie gubią, a wyszukiwanie po tych danych jest naturalne (są tam, gdzie
reszta metadanych). Instancja obiegu trzyma wyłącznie **przebieg**.

### `WorkflowTemplate`
Definicja grafu, wersjonowana. Stany: `Draft` → `Published` → `Deprecated`.
**Wersja opublikowana jest niezmienna** — edycja tworzy nową wersję.

### `WorkflowInstance`
Przebieg jednego dokumentu przez obieg. Trzyma **kopię definicji z chwili startu**;
`templateUuid` + `templateVersion` są tylko metryką pochodzenia ([§4.2](#42-snapshot-w-instancji)).

### `WorkItem`
Pojedyncza czynność do wykonania przez człowieka: przypisanie, termin, status, wynik.
Osobna tabela, bo po niej idzie skrzynka „moje zadania” — najczęściej odpytywany widok modułu.

> **Nazewnictwo.** `job`/`job_item` są zajęte przez operacje masowe, „zadania” w UI oznaczają
> historię zadań z Notification. Czynność obiegu nazywa się `WorkItem` / „czynność” — nigdy
> `Task` ani `Job`.

### Niezmiennik międzyagregatowy
„Dokument w najwyżej jednym aktywnym obiegu” egzekwuje **częściowy unikalny indeks**
(`unique (document_uuid) where status = 'Running'`), nie kod aplikacji.

---

## 3. Typ dokumentu

`DocumentType` jest **daną, nie klasą**: kod (`invoice`, `cv`), schemat metadanych, domyślny
szablon obiegu, klasa retencji, domyślne reguły dostępu. Nowy typ nie wymaga wdrożenia kodu.

### 3.1 Gdzie leżą metadane
Źródłem prawdy jest `document.metadata` (jsonb) walidowane schematem typu przy zapisie.
Jsonb sam w sobie **nie wystarcza do listy** — strona odczytu sortuje i paginuje serwerowo po
whiteliście kolumn, a sortowanie po `metadata->>'grossAmount'` z castem jest kruche i źle się
indeksuje.

### 3.2 Sortowalne atrybuty — sloty typowane
`document` ma stałą pulę kolumn slotowych: `num_1..num_4`, `text_1..text_4`, `date_1..date_4`.
`DocumentType` mapuje nazwę pola na slot (`grossAmount → num_1`, `contractorName → text_1`,
`issuedOn → date_1`). Zapis wypełnia jednocześnie `metadata` i slot.

Dlaczego tak, a nie inaczej:

| Wariant | Dlaczego odpadł |
|---|---|
| Indeksy wyrażeniowe na jsonb | Każdy nowy sortowalny atrybut i tak wymaga migracji — zysk „bez migracji” jest pozorny, a casty w SQL wywracają się na danych |
| Tabela projekcji per typ (`invoice_projection`) | Czyste, ale nowy typ dokumentu = migracja; sprzeczne z „typ to dana” |
| EAV (`document_attribute` z kolumnami wartości) | Sortowanie i paginacja po dwóch atrybutach to dwa joiny; plany zapytań degradują się szybciej niż przyrasta wolumen |

Koszt slotów: **mapowanie pole↔slot jest niezmienne po pierwszym użyciu.** Przemapowanie slotu
na inne pole podmienia znaczenie danych historycznych — walidacja przy edycji typu musi tego
zabronić. Indeksy zakładamy częściowe, per typ:
`create index … on document (num_1) where document_type_id = :invoice`.

Ścieżka ewolucji: gdy jeden typ urośnie na tyle, że sloty przestaną wystarczać, dostaje własną
tabelę projekcji — reszta typów zostaje na slotach.

### 3.3 Granica z księgowością
DMS trzyma **nagłówek faktury potrzebny do obiegu i wyszukiwania**, nie księgowość.
Pełne rozstrzygnięcie granicy i moment wydzielenia mikroserwisu → [§12](#12-granice-modułu--czego-tu-nie-ma). Pozycje,
dekretacja i VAT należą do modułu finansowego, który dostaje zdarzenie integracyjne po
zakończeniu obiegu. Bez tej granicy DMS spuchnie w drugi ERP.

---

## 4. Szablon obiegu

### 4.1 Graf
Węzeł: `id`, `kind`, `config` (jsonb), pozycja `x`/`y` dla edytora.
Krawędź: `from`, `to`, warunek.

Rodzaje bloków to **rejestr wtyczek w kodzie**: `IWorkflowNodeHandler` z kodem typu, wyłapywany
skanem zestawów przez `AddErpModule` — dokładnie jak `IBatchRule` (patrz
[`architecture.md`](./architecture.md), reguła „rejestracje DI nie idą do `Program.cs`”).
Każdy handler deklaruje schemat swojego `config`, walidowany **przy publikacji szablonu**,
nie przy wykonaniu — błędna konfiguracja nie może wybuchnąć trzy tygodnie po starcie obiegu.

Zestaw startowy: `start`, `end`, `userForm`, `approval` (z kworum), `gateway` (XOR po warunku /
AND split-join), `automatic` (wywołanie komendy), `timer`, `archive`.

### 4.2 Snapshot w instancji
Start obiegu kopiuje całą definicję do `workflow_instance.definition_snapshot`.
To jednym ruchem spełnia oba wymagania:

- zmiana szablonu nie dotyka trwających instancji — czytają snapshot,
- modyfikacja ad hoc instancji (dodanie kroku, pominięcie, zmiana przypisania) edytuje snapshot
  i nie dotyka szablonu.

Każda modyfikacja snapshotu jest zdarzeniem audytowym z diffem i autorem — inaczej nie da się
przy kontroli wyjaśnić, czemu ten dokument poszedł inną drogą niż szablon.

### 4.3 Przypisanie wykonawcy
Nie „user X”, tylko mały język strategii: rola, jednostka organizacyjna, przełożony inicjatora,
wykonawca kroku N, pole z metadanych dokumentu (np. opiekun kontrahenta).
`IAssigneeResolver` z kodem strategii, skanowany jak węzły. Doklejenie tego później oznacza
przepisanie każdego istniejącego szablonu.

### 4.4 Warunki na krawędziach
Matryca kwotowa (do 5 000 kierownik, powyżej zarząd) **nie jest** osobnym typem bloku — to
warunek na krawędzi wychodzącej z `gateway`. Język warunków musi więc sięgać metadanych
dokumentu. Definiujemy go **wąsko** (porównania, `and`/`or`, ścieżka do pola, literały);
wyrażenia ogólnego przeznaczenia wykonywane z bazy to podatność, nie funkcja.

### 4.5 Reguły na kroku
Zasada czworga oczu („kto opisał, nie akceptuje”) jest regułą walidacyjną kroku, nie własnością
grafu. W fakturach jest wymogiem kontrolnym — wchodzi od pierwszej wersji.

---

## 5. Silnik obiegu

### 5.1 Tokeny, nie kursor
Instancja trzyma **zbiór aktywnych tokenów** (węzeł + kontekst), nie pojedynczy `currentNodeId`.
Model sekwencyjny jest tańszy, ale „dwie akceptacje równolegle” i „opis merytoryczny równolegle
z kontrolą formalną” pojawiają się w fakturach natychmiast, a doklejenie AND-split/join do
kursora to przepisanie silnika. Wchodzimy od razu z tokenami.

### 5.2 Zasada nadrzędna: zero stanu w pamięci procesu
Każdy postęp obiegu to **komenda na agregacie `WorkflowInstance`**, w transakcji, z optymistyczną
kontrolą współbieżności po wersji instancji. Dwa równoległe „Akceptuj” nie mogą przesunąć tokenu
dwa razy — łapie to wersja, nie blokada. Podwójne kliknięcie łapie idempotencja po
`X-Request-Id` ([`cqrs.md` §6](./cqrs.md#6-pipeline-komend), front ma `withRequestId`).

Efekty uboczne (mail, generowanie PDF, wołanie innego modułu) idą **wyłącznie przez outbox** —
nigdy inline w transakcji postępu.

### 5.3 Praca odroczona w czasie
Kroki automatyczne, timery, terminy i eskalacje trafiają do tabeli:

```
workflow_scheduled_work(uuid pk, instance_uuid, node_id, kind, due_at,
                        status, attempts, lease_owner, heartbeat_at)
```

pobieranej przez `FOR UPDATE SKIP LOCKED` z `heartbeat_at` — **ten sam wzorzec, co
`BulkCommandRunner` i przebiegi eksportu**, zastosowany trzeci raz. Usługa tła deklaruje
`[ClusterSafe(powód)]`, inaczej nie przejdzie `BackgroundServiceTests`
([`multi-instance.md`](./multi-instance.md)).

To jest pierwszy w architekturze harmonogram **per encja** („obudź instancję X o 14:00”),
a nie cykliczny przemiał całej tabeli.

### 5.4 Operacje masowe
„Zaakceptuj 40 faktur” wpada wprost w istniejący kontrakt `BatchCommand<T,TFilter>` →
`job`/`job_item` z sukcesem częściowym ([`bulk-commands.md`](./bulk-commands.md)). Reguły
wstępne (czy user jest wykonawcą, czy krok jest akceptacją) to `IBatchRule<T>`
([`batch-validation.md`](./batch-validation.md)). Zero nowego mechanizmu.

---

## 6. Dostęp do dokumentu

Identity daje uprawnienia globalne. Faktura wymaga autoryzacji **per instancja** — to
najpoważniejsza luka, jaką ten moduł zamyka.

### 6.1 Pięć źródeł dostępu
1. **Uprawnienie funkcyjne** (`dms.document.read`) — Identity, stan obecny.
2. **Zakres organizacyjny** — dokument należy do spółki/działu, użytkownik ma nadania na jednostki.
3. **Dostęp z obiegu** — jesteś wykonawcą bieżącego kroku albo **byłeś** wcześniej (musisz widzieć
   to, co zaakceptowałeś). Dynamiczny, część wygasa.
4. **Jawne udostępnienie** — ad hoc, z terminem.
5. **Klasa poufności** — weto nad 1–4 (CV to dane osobowe, faktura zarządu bywa poufna).

### 6.2 Materializowany `document_acl`
```
document_acl(document_uuid, subject_kind, subject_id, permission,
             source, valid_from, valid_to, granted_by, granted_at)
```
Przeliczany zdarzeniami domenowymi (start obiegu, przypisanie kroku, zamknięcie kroku, zmiana
jednostki, udostępnienie). Powód wyboru jest wprost praktyczny: **lista dokumentów jest
paginowana i sortowana serwerowo, więc filtr dostępu musi być joinem w SQL.** Predykat liczony
w aplikacji rozsypuje paginację przy pierwszej realnej objętości.

Do tego **audyt nadań dostępu** analogiczny do `grant_audit` z Identity
([`identity-authz.md` §7](./identity-authz.md)) — przy kontroli pytanie „kto miał wgląd w tę
fakturę i z jakiego tytułu” waży tyle samo, co „kto ją zaakceptował”.

### 6.3 Dostęp do pliku
Endpoint zawartości sprawdza **ACL dokumentu**, nie samo uprawnienie funkcyjne. Dla klasy
poufnej presigned URL na 15 minut jest wyciekiem — obowiązuje strumieniowanie przez API
z jednorazowym, krótkim biletem. Reszta (kubełek per moduł, klucz MinIO per serwis, prefiks
postojowy, kasowanie przez outbox) bez zmian względem
[`media-storage.md`](./media-storage.md).

---

## 7. Wejście dokumentów

Trzy kanały, jedna droga wewnętrzna:

```
document_inbox(uuid pk, source, external_id, raw_payload, received_at,
               status, document_uuid, error_code)
unique (source, external_id)
```

`source` ∈ `Manual | Ksef | Email | Scan`. **Unikalny indeks `(source, external_id)` jest
deduplikacją** — KSeF potrafi dosłać ten sam dokument. `raw_payload` zachowany w oryginale.

Ręczne wgranie używa istniejącej ścieżki: bilet → presigned PUT → rejestracja → dopięcie
([`exports-artifacts.md` §9](./exports-artifacts.md#9-zawartość-wgrywana-przez-użytkownika--drugi-kubełek-druga-droga)).

**Reguły routingu** (`IntakeRule`): uporządkowana lista warunków na metadanych → szablon obiegu.
Brak dopasowania **nie może być błędem** — dokument trafia do obiegu `triage` z czynnością dla
człowieka. Bez tego automatyczny ingest zawiesza się na pierwszej nietypowej fakturze.

Konektor KSeF: adapter w `Dms.Infrastructure` za `IDocumentSource`, **nie osobny mikroserwis**.
Wydzielenie dopiero gdy pojawi się niezależna skala albo własny harmonogram.

---

## 8. Audyt i archiwizacja

### 8.1 `document_audit`
Append-only, zapisywany **w tej samej transakcji** co zmiana: kto, kiedy, co, na którym węźle,
w jakiej roli, na której wersji pliku, z jakim `correlation_id`. To zapis **biznesowy**, dowód
przy kontroli — nie może wylądować w logach aplikacyjnych ani w zewnętrznym systemie logów.

### 8.2 Metryka dokumentu
PDF „kto, co, kiedy” generuje istniejący mechanizm: `job.kind` + przebieg + artefakt w MinIO
([`exports-artifacts.md`](./exports-artifacts.md)). Dwie różnice wobec eksportów z Catalogu:

- **klasa artefaktu `archival`** — nie wygasa; retencja liczona latami (faktury 6 lat, akta
  osobowe znacznie dłużej). To trzecia klasa obok transient i trwałej.
- **niezmienność** — SHA-256 zapisany w bazie przy generowaniu.

Metrykę można wygenerować **na żądanie w każdej chwili** (podgląd), ale **przy archiwizacji
powstaje wersja zamrożona z hashem** i to ona jest dowodem. Po archiwizacji dokument jest
read-only.

### 8.3 Plik główny a załączniki
Dwie różne rzeczy, nie jedna lista: **plik główny jest wersjonowany** (skan → wersja podpisana),
**załączniki** (metryka, protokół, korespondencja) są osobnym zbiorem. Mieszanie ich mści się
przy retencji — załącznik i dokument mogą mieć różne okresy przechowywania.

---

## 9. Sterowanie przebiegiem

### 9.1 Cofnięcie
Token wraca do wcześniejszego węzła. Wyniki anulowanych kroków **nie znikają** — dostają status
`Superseded`, ponowne wejście tworzy nowy `WorkItem`. **Powód cofnięcia jest obowiązkowy.**

Dwa różne uprawnienia:
- `dms.workflow.return` — krok wstecz zgodnie z definicją grafu,
- `dms.workflow.jump` — skok administracyjny w dowolne miejsce, mocniej audytowany.

### 9.2 Przekierowanie na inny obieg
Zamknięcie instancji statusem `Redirected` + start nowej z `previous_instance_uuid`.
**Łańcuch instancji, nie podmiana grafu w locie** — czytelniejszy przy kontroli. Dane zebrane
w krokach nie giną, bo żyją na dokumencie ([§2](#2-agregaty)).

### 9.3 Reszta mechanizmów
Pojawią się natychmiast, więc są częścią projektu, nie „może kiedyś”:
delegacja/zastępstwo (urlop), eskalacja po terminie, przypomnienia, anulowanie obiegu,
wstrzymanie (`Hold`), wycofanie własnej decyzji w oknie czasowym, komentarze/wątki przy
dokumencie, podpis elektroniczny.

### 9.4 Formularze z definicji
Pola kroku pochodzą z `config` węzła, więc formularz powstaje w runtime. To nowy wzorzec na
froncie — nie ma go w żadnym obecnym module.

---

## 10. Kontrakt listy dokumentów (front)

Najczęściej używany ekran modułu. Trzy decyzje, które przesądzają o jego użyteczności.
Pozostałe strony modułu → [`dms-pages.md`](../frontend/dms-pages.md).

### 10.1 Zakres jako przełącznik, nie filtr
Jedna strona, przełącznik zakresu nad tabelą: **`Moje czynności` / `Wszystkie dostępne` /
`Obserwowane`**. Technicznie ten sam endpoint `searchDocument` z parametrem `scope`; dla
`scope=assignedToMe` dochodzi join do `work_item`. Dwie osobne strony zmuszałyby użytkownika do
zgadywania, gdzie patrzeć.

**Klucz wiersza zależy od zakresu:** w `Moje czynności` wiersz to `WorkItem` (jeden dokument
może mieć dwie moje czynności — dedup zgubiłby jedną), w pozostałych zakresach wiersz to
`Document`. Orkiestrator trzyma wiersze po UUID ([`smart-tables.md`](../frontend/smart-tables.md)),
więc musi wiedzieć, czyje to UUID-y.

### 10.2 Typ dokumentu jako kontekst tabeli
Filtr typu **nie jest jednym z wielu filtrów** — jest przełącznikiem kontekstu (zakładki albo
select nad tabelą), bo zmienia zestaw kolumn:

- **bez zawężenia do typu** — tylko kolumny wspólne: tytuł, typ, status, bieżący krok, wykonawca,
  termin, data wpływu;
- **`documentType = invoice`** — dokładane kolumny z profilu typu: numer, kontrahent, kwota brutto,
  waluta, termin płatności, wszystkie sortowalne.

Kolumny typo-specyficzne są dostępne **wyłącznie** przy zawężeniu do jednego typu. Inaczej
„kwota faktury” dla CV jest pusta, a sortowanie po niej nie znaczy nic.

Zmiana typu **resetuje sortowanie i filtry typo-specyficzne** — inaczej front wyśle `sort` po
kolumnie, której w nowym kontekście nie ma, i backend odrzuci żądanie na whiteliście.

### 10.3 Skąd front wie, jakie są kolumny
Endpoint `getDocumentTypeProfile` zwraca listę pól typu: klucz, klucz tłumaczenia, typ danych,
sortowalność, filtrowalność. `ErpTableBuilder` buduje `computed<ErpTableConfig>` z tego profilu —
definicja kolumn jest **danymi z backendu**, nie stałą w kodzie komponentu. Whitelist sortowania
po stronie backendu to kolumny wspólne `document` + sloty aktywnego typu ([§3.2](#32-sortowalne-atrybuty--sloty-typowane));
oba końce czytają z tego samego profilu, więc nie da się ich rozjechać.

Do tego, bo księgowa i kadrowa chcą czego innego:
- widoczność/kolejność kolumn zapisywana **per użytkownik i typ**,
- zapisane widoki („Moje do akceptacji”, „Faktury po terminie”).

### 10.4 Realtime
Sygnatury: `dms.document`, `dms.workflowInstance`, `dms.workItem`. Skrzynka czynności musi
odświeżać się sama w chwili przypisania. Rejestracja sygnatur w `AggregateSignatures` musi zgadzać
się z `signalrSignature` orkiestratorów ([`realtime-signalr.md`](./realtime-signalr.md)).

E-mail: DMS **tylko publikuje zdarzenie**; kanał e-mail dokłada Notification. Wysyłka nie
rozłazi się po modułach.

---

## 11. Kolejność wdrożenia

| Faza | Zakres | Co weryfikuje |
|---|---|---|
| 0 | Mikroserwis `Dms`, schemat `dms`, `Document` + `DocumentType` + sloty, upload, lista serwerowa, przepisanie atrapy frontu | Szablon modułu na nowej domenie |
| 1 | Silnik z tokenami, snapshot, `WorkItem`, skrzynka czynności, cofanie. Szablony w seedzie | **Czy architektura udźwignie długożyjący proces** |
| 2 | Edytor szablonów, wersjonowanie, publikacja z walidacją configu węzłów | Konfiguracja jako dane |
| 3 | `document_acl` + audyt nadań | Autoryzacja per instancja zasobu |
| 4 | Bloki automatyczne, `workflow_scheduled_work`, SLA/eskalacje, AND-split/join | Harmonogram per encja, równoległość |
| 5 | Archiwizacja: klasa `archival`, metryka PDF z hashem, retencja, read-only | Artefakt trwały |
| 6 | `document_inbox`, KSeF, reguły routingu, `triage` | Ingest zewnętrzny + deduplikacja |
| 7 | Delegacja, przekierowanie, masowa akceptacja, podpis | Dojrzałość procesowa |

Faza 1 sama odpowiada na główne pytanie architektoniczne. Reszta jest rozbudową.
Które strony frontu wchodzą w której fazie → [`dms-pages.md` §9](../frontend/dms-pages.md#9-kolejność-względem-faz-wdrożenia).

---

## 12. Granice modułu — czego tu nie ma

DMS mówi „faktura” w każdym zdaniu, więc kusi, żeby wydzielić z niego mikroserwis księgowości —
albo odwrotnie, żeby dopisać do niego dekretację i rejestr VAT. Obie pokusy rozstrzygamy tutaj,
bo odpowiedź przesądza, **co wolno wpisać do `Dms.Domain`**, a nie ile procesów uruchamiamy.

### 12.1 Podział własności: DMS a księgowość

Granica nie biegnie po typie dokumentu, tylko po tym, **czym rzecz jest**:

| Właściciel | Co posiada |
|---|---|
| **DMS** | Dokument i jego droga: plik, wersje, obieg, kto co zaakceptował, kto miał wgląd, kiedy zarchiwizowano |
| **Accounting** (📐 nie istnieje) | Fakt finansowy: dekretacja, plan kont i wymiary, rejestr VAT, okres rozliczeniowy, rozrachunki, eksport do FK/JPK |

Ta sama faktura jest w DMS **dokumentem w obiegu**, a w księgowości **zobowiązaniem**. To dwie
różne rzeczy o tej samej nazwie w rozmowie z użytkownikiem.

### 12.2 Dlaczego księgowość nie powstaje teraz

Fazy 0–7 nie zawierają **ani jednego** elementu prawdziwej księgowości: nie ma planu kont, MPK,
wymiarów analitycznych, okresów, zamknięcia miesiąca ani VAT. Osobny mikroserwis byłby dziś
pustym opakowaniem na cztery pola nagłówka.

Drugi powód jest twardszy: **zakaz joinów cross-schema**. Gdyby kwota brutto i kontrahent
mieszkały w schemacie `accounting`, DMS nie posortowałby własnej listy po tych kolumnach — a to
jest cała [§10](#10-kontrakt-listy-dokumentów-front) (sloty, whitelist sortowania, paginacja
serwerowa). Kopia nagłówka w `dms` byłaby konieczna tak czy inaczej. **Duplikacja nagłówka nie
jest długiem, tylko ceną reguły cross-schema** — płaci się ją niezależnie od momentu podziału.

### 12.3 Szew do zastosowania od fazy 1

Granicę rysujemy w kodzie od razu, serwis wydziela się później i tanio:

1. **`Dms.Domain` nie zna pojęć księgowych.** Żadnego `PostingLine`, `AccountNumber`,
   `VatRegister`. Dekretacja jest w DMS **wynikiem kroku** — jsonb wg schematu węzła, jak każdy
   inny formularz ([§9.4](#94-formularze-z-definicji)). Typowana dekretacja w `Dms.Domain`
   zamienia przyszłe wydzielenie z przeniesienia w przepisanie.
2. **Zdarzenie integracyjne `InvoiceApproved` w `Erp.BuildingBlocks.Contracts` od fazy 1**, nawet
   jeśli nikt go nie konsumuje. Jeden plik, a wyznacza granicę, zanim ktoś ją przypadkiem
   przekroczy.
3. **Reguła w `Erp.ArchitectureTests`**: `Dms.*` nie referuje niczego księgowego.
4. **Zatwierdzenie w DMS nie zapisuje do ksiąg.** Publikuje zdarzenie; księgowość tworzy własny
   dokument u siebie. Odrzucenie po tamtej stronie (zamknięty okres, brak konta) wraca zdarzeniem
   i cofa obieg — **proces kompensujący, nie transakcja rozproszona**.

Front jest na to gotowy bez zmian: nie ma BFF, każdy moduł woła własne API, więc formularz
dekretacji może być komponentem serwowanym przez remote `accounting` i osadzonym na karcie
dokumentu DMS — Native Federation dokładnie do tego służy
([`architecture.md`](../frontend/architecture.md)).

### 12.4 Kiedy wydzielić — wyzwalacze

Nie „gdy urośnie”, tylko którykolwiek z tych:

- pojawia się **plan kont i wymiary analityczne** z własnym cyklem życia i wolumenem,
- pojawia się **zamknięcie okresu** — wymaga blokad, których nie chcemy w serwisie obsługującym
  akceptacje w czasie rzeczywistym,
- **retencja i reżim audytu się rozjeżdżają** — księgi mają inne wymogi niż metryka obiegu,
- księgowość dostaje **własny rytm zmian** (przepisy podatkowe), niezależny od konfiguracji procesów.

Żaden z nich nie zachodzi w fazach 0–7.

### 12.5 Silnik obiegu zostaje w DMS

Bardziej kusi inny podział: wyciągnąć silnik jako generyczny mikroserwis obiegów „dla urlopów,
zamówień, wszystkiego”. Odrzucone:

- postęp obiegu, zmiana `document_acl` i wpis do `document_audit` **muszą być w jednej
  transakcji** — rozdzielenie zamienia każde kliknięcie „Akceptuj” w transakcję rozproszoną,
- snapshot definicji jest per dokument, więc silnik nie miałby własnych, niezależnych danych,
- obowiązuje precedens już zapisany w [`CLAUDE.md`](../../CLAUDE.md) i
  [`media-storage.md` §1 „Biblioteka, nie mikroserwis”](./media-storage.md#1-biblioteka-nie-mikroserwis):
  **„nie ma i nie będzie centralnego mikroserwisu do multimediów”**, bo referencja i rekord muszą
  leżeć w jednej transakcji. Tu rozumowanie jest identyczne.

Gdy inny moduł faktycznie będzie potrzebował obiegów, powstaje **`Erp.BuildingBlocks.Workflow`
jako biblioteka** — tak jak `Jobs`, `Validation` i `Artifacts`. Mechanizm współdzielony, dane
u właściciela.
