---
id: architecture.reporting
title: Raporty — gdzie żyją, jak nie zjadają serwera
summary: Architektura raportów, przebiegów ReportRun i izolacji zasobów Map/Reduce.
kind: architecture
scope: backend
audience:
  - backend
  - agent
triggers:
  - raport zestawienie lub agregacja
  - ciężki przebieg Map Reduce
related: []
---

# Raporty — gdzie żyją, jak nie zjadają serwera

Raporty korzystają z `ReportRun`, `ReportRunner`, `job.kind = Reduce`, `IArtifactStore`, kanału
`jobs` i retencji artefaktów. Dokument rozstrzyga, że raport **nie dostaje własnego podsystemu ani
własnego mikroserwisu**; kolejne definicje rozszerzają wspólny mechanizm.

Relacja do sąsiednich dokumentów:

| | [`exports-artifacts.md`](../guides/backend/exports-artifacts.md) | ten dokument |
|---|---|---|
| Odpowiada na | jak powstaje plik i jak użytkownik się o nim dowiaduje | gdzie należy raport i jak go odizolować od reszty systemu |
| Zakres | jeden producent (`ExportRun`) | wszystkie przebiegi typu *reduce*, w tym eksport po uogólnieniu |

---

## 1. Raport, eksport i zapytanie — trzy rzeczy, które łatwo pomylić

| | Zapytanie (`IXxxQueries`) | Eksport | Raport |
|---|---|---|---|
| Wynik | strona wyników w odpowiedzi HTTP | plik = wierny zrzut rekordów | plik = **agregacja** rekordów |
| Czas | milisekundy | sekundy–minuty | minuty–godziny |
| Kształt | — | 1 rekord źródłowy → 1 wiersz wyjścia | N rekordów → M wierszy, `GROUP BY`, sumy, okresy |
| Gdzie działa | wątek żądania | `BackgroundService` | `BackgroundService` |

Praktyczny wniosek: **eksport i raport różnią się wyłącznie tym, co robi funkcja przetwarzająca
strumień.** Reszta — przebieg, status, postęp, artefakt, powiadomienie, retencja, uprawnienie,
odzysk po awarii runnera — jest identyczna. Dlatego raport nie dostaje własnego podsystemu, tylko
**uogólnia istniejący**.

Granica po drugiej stronie jest równie ważna: jeżeli coś zwraca stronę wyników i mieści się
w budżecie żądania HTTP, **to nie jest raport, tylko zapytanie** — i należy do
[`cqrs.md`](../guides/backend/cqrs.md), nie tutaj. Zestawienie widoczne na ekranie w tabeli nie potrzebuje ani
przebiegu, ani pliku.

---

## 2. Biblioteka, nie mikroserwis

**Decyzja: nie powstaje mikroserwis raportowy. Raport wykonuje ten moduł, w którego schemacie leżą
dane, przez wspólną bibliotekę `Erp.BuildingBlocks.Reporting`.**

Argument rozstrzygający jest ten sam, który
[`media-storage.md` §1](../guides/backend/media-storage.md#1-biblioteka-nie-mikroserwis) postawił przy plikach:
**centralny serwis nie ma skąd wziąć danych.** Są dokładnie trzy drogi i każda przegrywa:

| Droga | Dlaczego odpada |
|---|---|
| Czytanie schematów innych modułów | Łamie zakaz joinów cross-schema — czyli **jedyną** rzecz, która utrzymuje granice modułów. Raport zamarza na wewnętrznym modelu Catalogu, a każda migracja w Catalogu psuje raport, o czym nikt się nie dowie do czasu następnego przebiegu. |
| Replikacja przez zdarzenia integracyjne | Poprawne technicznie, ale to koszt utrzymania osobnego read modelu **zanim** istnieje pierwszy raport. Buduje się infrastrukturę pod hipotezę. Patrz [§6](#6-raporty-cross-module) — to droga na później i pod konkretną potrzebę. |
| N wywołań HTTP do modułów | Najwolniejszy możliwy sposób przeczytania własnej bazy, z limitem strony i serializacją JSON na każdym kroku. |

Wniosek działa w obie strony i dlatego jest projektowy, a nie preferencyjny: **raport musi się
wykonywać w granicy transakcyjnej, w której leżą raportowane dane.** To wymusza „moduł jest
właścicielem swoich raportów" i zamyka sprawę.

To **nie** znaczy, że każdy moduł pisze raportowanie od zera. Rozdziel dwie rzeczy, bo pytanie
„czy ma być jeden byt odpowiedzialny za raportowanie" skleja je w jedno:

- **Jeden wspólny mechanizm** — `Erp.BuildingBlocks.Reporting`: agregat przebiegu, `ReportRunner`,
  `IReportDefinition`, kontrakt HTTP, konwencja uprawnień, retencja. Jeden kod, jedna strona
  „Raporty" na froncie.
- **Rozproszone wykonanie** — runner startuje w każdym module, który ma definicje raportów,
  i czyta wyłącznie swój schemat.

Dokładnie jak `Erp.BuildingBlocks.{Jobs,Artifacts,Validation}`. Jednostką współdzielenia w tym
backendzie jest `building-blocks`, nie serwis.

---

## 3. `ReportRun` — uogólnienie `ExportRun`, nie drugi agregat obok

`ExportRun` ma dziś `Format`, `ParametersJson`, `Status`, `ArtifactUuid`, `heartbeat_at`. Raport
potrzebuje **tego samego plus jednego pola**: klucza wskazującego definicję.

```csharp
public sealed class ReportRun : AggregateRoot
{
    public string ReportKey { get; private set; }       // "catalog.product-export", "sales.revenue-by-category"
    public string Format { get; private set; }          // "xml", "csv", "xlsx"…
    public string? ParametersJson { get; private set; } // filtr źródła + parametry raportu
    public ReportRunStatus Status { get; private set; }
    public Guid? ArtifactUuid { get; private set; }
    public string? ErrorCode { get; private set; }
}
```

**Eksport staje się jedną z definicji raportu** (`catalog.product-export`), a nie osobnym bytem
obok. Trzymanie dwóch agregatów przebiegu różniących się jednym polem oznaczałoby dwa runnery, dwie
ścieżki odzysku po awarii, dwa endpointy pobierania i dwie retencje do utrzymania w zgodzie —
wszystko po to, żeby odróżnić `GROUP BY` od jego braku.

Co się przez to samo załatwia, bo już działa dla `ExportRun`:

- `job.kind = Reduce` — status `Completed` albo `Failed`, **nic pośredniego**. Uzasadnienie
  z [`exports-artifacts.md` §3](../guides/backend/exports-artifacts.md#3-jobkind--map-i-reduce-dzielą-tabelę)
  obowiązuje tym mocniej: raport zsumowany w 96% jest raportem błędnym, nie częściowym.
- `AggregateChanged` ze skanu ChangeTrackera → realtime bez linijki kodu w runnerze.
- Kanał `jobs` adresowany `user:{userId}` → dzwonek i „Pobierz" u zleceniodawcy.
- `Artifacts:Stores:transient:RetentionDays` → artefakt i wiersz `job` wygasają razem.
- Uprawnienie w istniejącej konwencji: `{moduł}.report.{klucz}.run`.

**Migracja `ExportRun` → `ReportRun` łamie kontrakt NSwag** (`searchExportRun` → `searchReportRun`,
`ExportRunCreateCommand` → `ReportRunCreateCommand`) i wymaga świadomej regeneracji klienta oraz
zmiany sygnatury `catalog.export_run` w `AggregateSignatures` — patrz
[`endpoint-naming.md`](../guides/backend/endpoint-naming.md). Zrobić to **przed** pierwszym raportem; po jest
dwukrotnie drożej.

---

## 4. `IReportDefinition` — jedyne, co pisze autor raportu

```csharp
public interface IReportDefinition
{
    string Key { get; }                       // "sales.revenue-by-month"
    IReadOnlySet<string> Formats { get; }     // "csv", "xlsx"

    // Pre-check kosztu — patrz §5.4. Odmowa PRZED założeniem przebiegu.
    Task<ReportEstimate> EstimateAsync(ReportParameters p, CancellationToken ct);

    // Strumień, nie lista. Runner nie zobaczy nigdy całego wyniku naraz.
    IAsyncEnumerable<ReportRow> StreamAsync(ReportParameters p, CancellationToken ct);
}
```

Implementacje wyłapuje skan zestawów w `AddErpModule` — nowa definicja **nie dopisuje `AddScoped`**
nigdzie, ma tylko leżeć w `{Modul}.Application` i implementować interfejs. Konwencja rejestracji
z [`architecture.md`](backend.md) obowiązuje bez wyjątku.

`ReportRunner` jest jeden dla wszystkich definicji i robi dokładnie to, co dziś `ExportRunner`:
krótka transakcja przejęcia pod `SKIP LOCKED`, bicie serca w `heartbeat_at`, postęp co 500
rekordów, artefakt zapisany **przed** zmianą statusu, `[ClusterSafe(...)]` z uzasadnieniem.

---

## 5. Izolacja zasobów — cztery niezależne problemy

Pytanie „jak zrobić, żeby duży raport nie zablokował innych zadań ani nie zjadł serwera" to
w rzeczywistości cztery pytania. Mylenie ich kończy się rozwiązaniem, które nie działa, bo leczy
nie ten poziom.

### 5.1 Kolejka zadań — osobne pule slotów dla `Map` i `Reduce`

`FOR UPDATE SKIP LOCKED` daje równoległość, ale **nie daje sufitu**. Potrzebne są dwa niezależne
limity:

```
Jobs:MapSlots     = 2   # BulkCommandRunner
Jobs:ReduceSlots  = 1   # ReportRunner
```

Wspólna pula byłaby konkretnym błędem: jeden raport na czterdzieści minut zająłby slot, którym
przelatują operacje masowe, i użytkownicy zobaczyliby zamrożone zadania w dzwonku bez żadnego
związku z raportowaniem. Runnery już dziś są rozdzielone filtrem `kind` — limity muszą pójść tą
samą granicą.

Do tego **limit równoległych przebiegów na użytkownika** (1–2), sprawdzany przy zakładaniu
przebiegu. Bez niego jedna osoba zleca dziesięć raportów i kolejka `Reduce` należy do niej na
godziny. Odmowa z `errorCode` jest tu właściwą odpowiedzią, nie cichym ustawieniem w kolejce.

### 5.2 Proces — rola obciążeniowa, nie osobny serwis

Odpowiedź na „a może osobny serwer" brzmi: **osobna instancja tego samego serwisu**, nie osobny
serwis. Wzorzec już istnieje — `Realtime:Role` (`Hub`/`Relay`) z
[`multi-instance.md` §4](multi-instance.md). To samo dla obciążenia:

```
Workload:Roles = Api          # nie rejestruje żadnego BackgroundService
Workload:Roles = Runner       # runnery, bez ruchu HTTP z load balancera
Workload:Roles = Both         # domyślne — dev zachowuje się jak dziś
```

Domyślne `Both` jest warunkiem, żeby `dotnet run --project Catalog.Api` dalej robiło wszystko —
zasada trwałego właściciela z [`multi-instance.md`](multi-instance.md#granice-odpowiedzialności).

Dopiero to daje twardą izolację: kontener z rolą `Runner` dostaje limity `cpus` i `memory`
w compose/k8s i **fizycznie nie jest w stanie** zagłodzić instancji API. Ten sam obraz, inna
konfiguracja, zero nowego mikroserwisu do wdrażania, monitorowania i wersjonowania.

### 5.3 Baza danych — prawdziwe wąskie gardło

Ciężki raport rzadko zabija CPU aplikacji. Zabija Postgresa — i to jest jedyny zasób realnie
współdzielony przez wszystkie moduły. Postgres nie ma priorytetów zapytań, więc separacja musi być
pojemnościowa albo fizyczna:

| Środek | Co ogranicza | Kiedy |
|---|---|---|
| Osobny connection string runnera z `Maximum Pool Size=2` | ile slotów połączeń raporty mogą zająć | od razu, darmowe |
| `statement_timeout` na sesji raportowej | pojedyncze zapytanie-potwór | od razu |
| `SET LOCAL work_mem` | pamięć sortowania na sesję | przy pierwszym `GROUP BY` na dużym zbiorze |
| **Read replica** + `ReadOnlyConnection` używany wyłącznie przez `ReportRunner` | całe obciążenie odczytem | gdy raporty zaczną być odczuwalne w API |

Read replica jest jedynym środkiem, który izoluje naprawdę — i jednocześnie najdroższym
operacyjnie (replikacja, opóźnienie, backup). Świadomie **na później**, ale projekt raportu ma być
na nią gotowy: skoro definicja czyta wyłącznie `AsNoTracking` i nigdy nie pisze, przełączenie
sprowadza się do podmiany łańcucha połączenia.

Osobno, i niezależnie od instancji: **żadnych długich transakcji.** Godzinny snapshot blokuje
`VACUUM` na całej bazie, więc psuje wydajność modułów, które z raportem nie mają nic wspólnego.
Rozwiązanie jest już w `ExportRunner` — krótka transakcja przejęcia, strumieniowanie poza nią,
bicie serca zamiast trzymanego locka.

### 5.4 Sam raport — zapobieganie zamiast leczenia

- **Nigdy synchronicznie w HTTP.** Endpoint zakłada przebieg i zwraca `BatchResult{JobUuid}`, tak
  jak eksport. Endpoint raportu, jak endpoint eksportu, **nie jest wsadowy** — zlecanie pięciu
  raportów naraz nie jest przypadkiem użycia, a `BatchEndpointBase` wyprodukowałby dwa zadania na
  jeden raport ([`exports-artifacts.md` §2](../guides/backend/exports-artifacts.md#2-agregat-przebiegu)).
- **Streaming, nigdy materializacja.** `IAsyncEnumerable` → formatter → `IArtifactStore.WriteAsync`.
  `.ToList()` na wyniku raportu to ten sam błąd, przed którym ostrzega `bulk-commands.md` przy
  `COPY`, tylko z większym zbiorem.
- **`EstimateAsync` przed założeniem przebiegu.** `COUNT` z limitem albo walidacja zakresu dat;
  przekroczony próg → odmowa z czytelnym `errorCode`. Czterdzieści minut mielenia zakończone
  timeoutem jest gorsze dla użytkownika niż natychmiastowe „zawęź zakres".
- **`CancellationToken` sprawdzany przy zapisie postępu**, żeby `job/cancel` faktycznie przerywał
  raport, a nie tylko oznaczał wiersz.
- **Agregacja w SQL, nie w C#.** `GROUP BY` po stronie Postgresa czyta indeks; ta sama suma
  w pętli po strumieniu przeciąga wszystkie wiersze przez sieć i stertę.

---

## 6. Raporty cross-module

Pierwszy raport, który naprawdę potrzebuje dwóch schematów naraz („sprzedaż w podziale na
kategorie produktów" = Sales × Catalog), **nie jest powodem do zbudowania serwisu raportowego.**
Kolejność odpowiedzi, od najtańszej:

1. **Denormalizacja przez zdarzenie integracyjne.** Sales trzyma u siebie `category_name` przypięte
   do pozycji zamówienia w chwili sprzedaży. Tanie, nie wprowadza nowego bytu, a przy okazji
   **poprawne historycznie** — raport za zeszły rok ma pokazać kategorię z chwili sprzedaży, nie
   dzisiejszą. Bardzo często to jest cała potrzeba.
2. **Read model w schemacie `analytics`**, karmiony zdarzeniami integracyjnymi, z **jednym
   właścicielem**. Dopiero gdy raportów cross-module jest kilka i denormalizacja zaczyna się
   powtarzać.
3. **Osobny serwis** — dopiero gdy istnieje schemat `analytics` z punktu 2. Wtedy serwis powstaje
   dlatego, że **ma własne dane**, a nie dlatego, że „raportowanie to osobna domena". To jedyne
   uzasadnienie, które w tej architekturze przechodzi.

Punkt 3 jest odległy i może nie nadejść nigdy. Nie budować go zawczasu.

---

## 7. Front — jedna strona, wiele źródeł

Katalog raportów **nie** jest centralnym endpointem. Każdy kontrakt remota eksponuje swoje
definicje, a host składa listę tak samo, jak składa menu — mechanizm już istnieje
([`frontend/architecture.md`](frontend.md)). Zlecenie raportu woła API modułu,
który go definiuje, przez `API_BASE_URL` tego modułu; nie ma warstwy agregującej, tak jak nigdzie
indziej w tym systemie.

Przebieg raportu jest zwykłym agregatem z orkiestratorem, cache i realtime, a odbiór gotowego pliku
idzie istniejącą ścieżką „Pobierz" w feedzie zadań —
[`frontend/notifications.md`](../guides/frontend/notifications.md). Bramkowanie akcji uprawnieniem
`{moduł}.report.{klucz}.run` przez `*erpHasPermission`.

---

## 8. Czego nie robić

- **Mikroserwisu raportowego czytającego cudze schematy** — [§2](#2-biblioteka-nie-mikroserwis).
- **Raportu synchronicznego w HTTP.** Timeout gatewaya to najgorszy możliwy komunikat o tym, że
  raport był za duży.
- **Raportu jako `job.kind = Map`.** `job_item` per rekord nic nie znaczy, gdy wynikiem jest jeden
  plik, a `retry-failed` nie regeneruje pliku.
- **Drugiego agregatu przebiegu obok `ExportRun`** — [§3](#3-reportrun--uogólnienie-exportrun-nie-drugi-agregat-obok).
- **Elasticsearcha, ClickHouse'a ani hurtowni** na tym etapie. Postgres z repliką wystarczy o rząd
  wielkości dłużej, niż się wydaje, a każda z tych rzeczy dokłada drugie źródło prawdy i drugi
  cykl życia danych do utrzymania.
- **Trzymania wygenerowanego raportu w `bytea`.** Ten sam argument, co przy eksportach: pompuje
  bazę i każdy backup o wolumen plików, których nikt nie czyta po tygodniu.
