# Eksporty i artefakty

**Stan: ✅ działa w Catalogu.** Legenda znaczników —
[`architecture.md`](./architecture.md#1-stan-wdrożenia). Magazyn artefaktów (MinIO), kolumna
`job.kind`, agregat `ExportRun` i `ExportRunner` są w kodzie i zweryfikowane end-to-end na żywej
infrastrukturze. Frontendowa strona (akcja „Pobierz" w feedzie zadań) jeszcze nie istnieje —
patrz [`docs/frontend/notifications.md`](../frontend/notifications.md).

> **Zakres tego dokumentu to jeden producent plików: eksport.** Rozstrzygnięcia obejmujące
> **wszystkie** pliki wszystkich modułów — układ kubełków, poświadczenia do magazynu, prefiksy
> obiektów i sprzątanie — mieszkają w [`media-storage.md`](./media-storage.md) i mają
> pierwszeństwo tam, gdzie §5, §7 i §9 poniżej opisują dzisiejszy, węższy stan.

---

## 1. Dlaczego eksport nie jest komendą `Exec`

Operacje masowe dzielą się na dwa kształty, które łatwo pomylić, bo obie „robią coś dla wielu
agregatów":

| | **map** | **reduce** |
|---|---|---|
| Wejście → wyjście | N celów → N niezależnych wyników | N celów → **jeden** artefakt |
| Sukces częściowy | ma sens („1200 pozycji odpadło") | nie ma sensu — nie istnieje XML udany w 96% |
| Granica transakcji | chunk | cały przebieg |
| Przykład | `ProductSetPriceCommand` | eksport katalogu do XML |

`job`/`job_item` + `BulkCommandRunner` ([`bulk-commands.md`](./bulk-commands.md)) to silnik
**wyłącznie map-owy**: `job_item` per agregat, status per element, `retry-failed` per element,
chunk jako transakcja. Wpychanie do niego eksportu rozjeżdża się w każdym z tych punktów naraz —
status per produkt nic nie znaczy, plik trzeba zapisać strumieniowo w ustalonej kolejności ponad
chunkami, a ponowienie 1200 elementów nie regeneruje pliku.

Dlatego eksport **nie jest komendą `Exec` na agregacie źródłowym**
([`endpoint-naming.md` §5](./endpoint-naming.md#5-exec-i-jego-granica)). Jest `Create` na
osobnym agregacie przebiegu.

---

## 2. Agregat przebiegu

```csharp
public sealed class ExportRun : AggregateRoot
{
    public string Format { get; private set; }          // "xml", "csv"…
    public string? ParametersJson { get; private set; } // filtr źródła + opcje formatu
    public ExportRunStatus Status { get; private set; }
    public Guid? ArtifactUuid { get; private set; }     // wypełniane po zakończeniu
    public string? ErrorCode { get; private set; }
}
```

Komenda: `ExportRunCreateCommand` — zwykły `Create`, uuid od klienta.

> **Endpoint eksportu NIE jest wsadowy** — jako jedyny w module. Eksport już jest operacją
> zbiorczą, tyle że po produktach, nie po przebiegach; zlecenie pięciu eksportów naraz nie jest
> przypadkiem użycia. Przepuszczenie tej komendy przez `BatchEndpointBase` miało konkretny, zły
> skutek: powstawały **dwa** zadania na jeden eksport — map-owe, wykonujące komendę tworzącą,
> i `Reduce`, robiące plik. Klient dostawał `jobUuid` tego pierwszego, więc dzwonek pokazywał
> „gotowe" w chwili, w której eksport dopiero się zaczynał. Odpowiedź zostaje typu `BatchResult`,
> żeby frontend rejestrował zadanie tak samo jak każde inne.

To, co się przez to samo załatwia:

- `AggregateChanged` leci **automatycznie** ze skanu ChangeTrackera przy każdej zmianie statusu —
  nie trzeba niczego publikować ręcznie ([`events-outbox.md`](./events-outbox.md))
- nowa sygnatura `catalog.export_run` w `AggregateSignatures` daje frontendowi normalny
  orkiestrator, cache i realtime ([`realtime-signalr.md`](./realtime-signalr.md))
- uprawnienie wpada w istniejącą konwencję `{moduł}.{zasób}.{akcja}` → `catalog.export_run.create`
  ([`identity-authz.md`](./identity-authz.md))
- historia eksportów jest zwykłą listą agregatów, z `searchExportRun`/`getExportRun`

---

## 3. `job.kind` — map i reduce dzielą tabelę

Przebieg eksportu **musi** mieć wiersz w `job`. Nie dla wykonania, tylko dlatego, że w `job` żyje
wszystko, co czyni długą operację widoczną dla użytkownika: `user_id`, `status`, liczniki postępu,
`expire_on`, replika w Notification, `JobCompletedHandler` i kanał `jobs` (patrz sekcja 8).
Zbudowanie tego drugi raz obok byłoby duplikacją całego podsystemu powiadomień.

Rozdziela je jedna kolumna:

```
job(..., kind)     kind ∈ Map | Reduce
```

| | `Map` | `Reduce` |
|---|---|---|
| Kto podejmuje | `BulkCommandRunner` | `ExportRunner` |
| `job_item` | jeden na agregat | **brak** |
| `total_count` | liczba celów | liczba rekordów źródłowych (tylko postęp) |
| `succeeded_count` | przetworzone elementy | zapisane rekordy (tylko postęp) |
| Statusy końcowe | `Completed`, `CompletedWithErrors` | `Completed` albo `Failed` — nic pośredniego |
| `retry-failed` | ponawia elementy | **nie dotyczy** — powtórzeniem jest nowy przebieg |

`BulkCommandRunner` filtruje po `kind = Map` w zapytaniu o najstarsze zadanie. To jedyna zmiana
w istniejącym runnerze — bez niej podjąłby przebieg eksportu, nie znalazł `job_item`-ów i uznał
zadanie za puste.

> **Dlaczego `Reduce` nie ma `CompletedWithErrors`.** Sukces częściowy opisuje zbiór niezależnych
> wyników. Plik jest jeden i albo jest kompletny, albo go nie ma — status pośredni kazałby
> użytkownikowi zgadywać, czy pobrany eksport zawiera wszystko. Rekord, którego nie da się
> zserializować, przerywa przebieg z `ErrorCode`; artefakt nie powstaje.

---

## 4. `ExportRunner`

`BackgroundService` czytający z bazy, tą samą zasadą co `BulkCommandRunner`: znajdź najstarszy
`Pending` przebieg `kind = Reduce`, wykonaj, zaktualizuj status.

Trzy rzeczy, które odróżniają go od runnera map-owego:

1. **Strumieniuje, nie materializuje.** Źródłem jest `IAsyncEnumerable<T>` z zapytania
   `AsNoTracking`, wyjściem strumień do magazynu artefaktów. Wciągnięcie 50 tys. rekordów do
   pamięci, żeby je zaraz zserializować, jest dokładnie tym błędem, który
   [`bulk-commands.md`](./bulk-commands.md) opisuje przy `COPY`.
2. **Aktualizuje postęp co N rekordów, nie co rekord.** Zapis licznika po każdym wierszu to
   50 tys. `UPDATE`-ów; co 500 wystarczy, żeby pasek postępu wyglądał na żywy.
3. **Artefakt zapisuje przed zmianą statusu.** Kolejność `zapisz plik → ustaw ArtifactUuid
   i status` gwarantuje, że nie istnieje moment, w którym przebieg jest `Completed`, a pliku
   jeszcze nie ma. Odwrotna kolejność daje użytkownikowi przycisk „Pobierz" prowadzący w pustkę.

`ExportRunner` zakłada **jedną instancję serwisu**, tak samo jak `BulkCommandRunner` — dopisz go
do listy w [`architecture.md` §7](./architecture.md#7-założenia-jednoinstancyjne) razem z resztą.

---

## 5. Magazyn artefaktów — MinIO

MinIO (API zgodne z S3) jako usługa w [`backend/docker-compose.yml`](../../backend/docker-compose.yml),
obok Postgresa i RabbitMQ — porty **9100** (API) i **9101** (konsola), przesunięte względem
domyślnych 9000/9001, bo 9000 jest na maszynach deweloperskich gęsto zajęty, a kolizja objawia się
wyłącznie tym, że kontener nie wstaje.

Implementacja żyje w `Erp.BuildingBlocks.Artifacts`, a abstrakcja — jak każda inna — w
`Erp.BuildingBlocks.Application/Abstractions`:

```csharp
public interface IArtifactStore
{
    // Zapis przez producenta wewnątrz procesu — eksporty i raporty. Ląduje od razu w `assets/`.
    Task<Guid> WriteAsync(ArtifactDescriptor descriptor, Func<Stream, CancellationToken, Task> write, CancellationToken ct);

    // Wgrywanie z przeglądarki: bilet → poczekalnia → walidacja → promocja. Patrz §9.
    Task<ArtifactUploadTicket> CreateUploadTicketAsync(TimeSpan ttl, CancellationToken ct);
    Task<ArtifactMetadata?> GetStagedMetadataAsync(Guid artifactUuid, CancellationToken ct);
    Task PromoteAsync(Guid artifactUuid, CancellationToken ct);
    Task DeleteStagedAsync(Guid artifactUuid, CancellationToken ct);

    // Odczyt i cykl życia zawartości potwierdzonej.
    Task<bool> ReadToAsync(Guid artifactUuid, Stream target, CancellationToken ct);
    Task<ArtifactMetadata?> GetMetadataAsync(Guid artifactUuid, CancellationToken ct);
    Task<Uri> GetDownloadUrlAsync(Guid artifactUuid, TimeSpan ttl, CancellationToken ct);
    Task DeleteAsync(Guid artifactUuid, CancellationToken ct);

    // Wyłącznie dla audytora rozjazdu — ścieżka gorąca adresuje po identyfikatorze z rekordu.
    IAsyncEnumerable<ArtifactListEntry> ListAsync(CancellationToken ct);
}
```

Odczyt idzie przez `ReadToAsync(… Stream target …)`, a nie przez zwrócenie `Stream`-a: klient S3
oddaje zawartość callbackiem, więc oddanie strumienia wymagałoby przełożenia jej przez plik
tymczasowy — pełny round-trip po dysku na każdą miniaturkę w galerii.

Interfejs zapisuje **przez callback na strumieniu**, a nie przyjmuje `byte[]` ani gotowego
`Stream`a — dzięki temu producent nie musi mieć całego artefaktu w pamięci, a implementacja
kontroluje moment otwarcia i zamknięcia zasobu.

Metadane artefaktu (nazwa pliku, `content_type`, rozmiar, `expire_on`) jadą jako **metadane
obiektu w MinIO**, a nie do osobnej tabeli — magazyn i tak je przechowuje, a druga kopia byłaby
drugim źródłem prawdy do utrzymania w zgodzie przy każdym zapisie i usunięciu. Rekordem, po którym
artefakt się znajduje i autoryzuje, jest agregat przebiegu (`ExportRun.ArtifactUuid`). Tabela stanie
się potrzebna dopiero wtedy, gdy pojawi się producent artefaktów bez własnego agregatu.

**Bajty nie idą do Postgresa** — `bytea` byłby prostszy, ale pompuje bazę i każdy backup
o wolumen eksportów, których nikt nie czyta po tygodniu.

Zapis idzie przez **plik tymczasowy**, nie przez bufor w pamięci: `PutObject` potrzebuje rozmiaru
obiektu, a przy zapisie sterowanym callbackiem nie znamy go, dopóki producent nie skończy. Bufor
załatwiłby to samo kosztem trzymania całego eksportu na stercie — czyli dokładnie tego, czego ten
interfejs ma unikać.

> **To NIE jest tymczasowe rozwiązanie w oczekiwaniu na DMS.** Wcześniejsza wersja tego dokumentu
> zapowiadała, że magazyn plików przejmie kiedyś moduł DMS. Ta zapowiedź jest **wycofana**:
> centralny serwis plików nie umiałby odpowiedzieć na pytanie „czy ten plik jest jeszcze czyjś",
> bo referencje żyją w schematach modułów biznesowych. `IArtifactStore` zostaje biblioteką,
> a każdy moduł rozmawia z magazynem sam — pełne uzasadnienie w
> [`media-storage.md` §1](./media-storage.md#1-biblioteka-nie-mikroserwis).
>
> DMS powstaje jako **moduł biznesowy** (faktury, umowy, obieg dokumentu) i trzyma swoje pliki
> we własnych kubełkach, dokładnie tak jak Catalog trzyma swoje.

---

## 6. Pobieranie

Dwie drogi, świadomie różne:

| | Presigned URL z MinIO | Proxy przez endpoint modułu |
|---|---|---|
| Autoryzacja | **bearer-owa** — kto ma link, ten pobiera | normalna, uprawnienie sprawdzane przy każdym żądaniu |
| Przepustowość | omija serwis | przez serwis |
| Kiedy | duże pliki, dane niewrażliwe | dane wrażliwe, audytowane pobrania |

Domyślnie **presigned z krótkim TTL** (minuty, nie dni), generowany **dopiero na kliknięcie**, za
sprawdzeniem uprawnienia — nigdy zapisywany w rekordzie przebiegu ani w `JobDto`. Link, który
przeleżał tydzień w cache przeglądarki albo w historii, jest linkiem, którego nikt już nie kontroluje.

Frontend dostaje **`artifactUuid`, nie URL**, i wymienia go na link w momencie pobierania.

---

## 7. Wygasanie

Artefakt i wiersz `job` muszą wygasać **razem**. Rozjazd w którąkolwiek stronę jest widoczny
dla użytkownika:

- artefakt znika pierwszy → przycisk „Pobierz" prowadzi do 404
- wiersz `job` znika pierwszy → plik zostaje w MinIO na zawsze, nikt o nim nie wie

Obie liczby pochodzą z **jednej opcji konfiguracyjnej** — `Artifacts:RetentionDays`. Ta sama
wartość ustawia `job.expire_on` przy zakładaniu przebiegu (`ExportJobFactory`) i regułę lifecycle
w kubełku (`ArtifactBucketInitializer`, reguła `erp-artifact-retention`, zakładana przy każdym
starcie modułu). Rozdzielenie ich na dwie niezależne konfiguracje było najprostszą drogą do
rozjazdu, więc go nie ma.

> **Gdzie ta opcja mieszka.** Po przejściu na słownik magazynów jest to
> `Artifacts:Stores:transient:RetentionDays` ([`media-storage.md` §2.4](./media-storage.md#24-kształt-konfiguracji)).
> Zasada „jedna liczba na retencję" została — zmieniło się tylko to, że jest jedna **na kubełek**,
> a nie jedna na moduł. Reguła obejmująca cały kubełek zakłada się wyłącznie tam, gdzie
> `RetentionDays` jest ustawione; kubełek `media` nie ma jej wcale, a próba jej tam ustawienia
> jest odrzucana przy starcie.

Reguła w magazynie jest przy tym **sprzątaczką, nie źródłem prawdy**: o tym, czy artefakt wolno
jeszcze pobrać, decyduje `job.expire_on` sprawdzane przez `getExportRunDownloadUrl`. Gdyby
rozstrzygał magazyn, użytkownik zamiast czytelnej odmowy dostawałby 404 z presigned URL-a, czyli
błąd wyglądający na awarię.

---

## 8. Jak użytkownik dowiaduje się, że jest gotowe

Tu jest pułapka, o którą łatwo się rozbić. Są **dwa kanały o zupełnie różnym adresowaniu**
([`realtime-signalr.md` §2](./realtime-signalr.md#2-grupy)):

| Kanał | Grupa | Kto dostaje |
|---|---|---|
| `agg:catalog.export_run` | subskrybenci sygnatury | **każdy**, kto ma ten agregat w cache |
| `jobs` | `user:{userId}` | **wyłącznie zleceniodawca** |

`agg:` to synchronizacja cache, nie powiadomienie. Gdyby `ExportRun` był tylko agregatem, zmiana
statusu odświeżyłaby dane u wszystkich i **nie powiadomiła nikogo**. Powiadomienie niesie kanał
`jobs`, wystawiany jawnie przez `JobCompletedHandler` — i to jest drugi powód, dla którego przebieg
musi mieć wiersz w `job` (pierwszy: sekcja 3).

Efekt: eksport pojawia się w dzwonku, w historii zadań i przeżywa zamknięcie przeglądarki, bez
pisania jednej linijki kodu powiadomień. Strona frontendowa —
[`docs/frontend/notifications.md`](../frontend/notifications.md).

---

## 9. Zawartość wgrywana przez użytkownika — drugi kubełek, druga droga

**Stan: ✅ działa w Catalogu** (multimedia produktów). Wszystko powyżej opisuje pliki, które
**produkuje system** i które mają wygasnąć. Plik wgrany przez użytkownika jest odwrotnością
obu tych założeń, więc różni się w dwóch miejscach — i tylko w dwóch.

### Kubełek

Reguła lifecycle jest w S3 własnością **kubełka**, a ta z sekcji 7 ma pusty prefiks, czyli
obejmuje wszystko, co w kubełku leży. Zdjęcie produktu zapisane obok eksportów zniknęłoby po
`RetentionDays` dniach — bez błędu, bez wpisu w logu, widoczne dopiero jako puste miniaturki
w katalogu. Dlatego kubełki są dwa:

| | `Artifacts:BucketName` (`erp-artifacts`) | `Artifacts:MediaBucketName` (`erp-media`) |
|---|---|---|
| Zawartość | eksporty, raporty, dokumenty | pliki wgrane przez użytkownika |
| Lifecycle | `erp-artifact-retention`, `RetentionDays` | **brak** |
| Cykl życia pliku | własny (`expire_on` przebiegu) | tyle, co agregat, który go opisuje |
| Jak po niego sięgnąć | `IArtifactStore` bez klucza | `[FromKeyedServices(ArtifactStoreKeys.Media)]` |

> **Nazwy w nagłówku tabeli są nieaktualne — podział klas nie.** Kubełki są dziś per moduł
> (`erp-catalog-artifacts`, `erp-catalog-media`), konfigurowane słownikiem `Artifacts:Stores`,
> a każdy serwis chodzi na własnym koncie MinIO zamiast na roocie —
> [`media-storage.md` §2](./media-storage.md#2-trzy-osie-separacji). Reszta tabeli, łącznie
> z ostatnim wierszem (bezkluczowy = wygasający, trwały jawnie przez klucz), obowiązuje.

Domyślna (bezkluczowa) rejestracja to magazyn **wygasający**, bo taki jest każdy plik
produkowany przez system. Zawartość trwała musi poprosić o siebie jawnie — odwrotny domyślny
kończyłby się cichym wydłużeniem życia eksportów zamiast głośnym błędem. Pilnuje tego test
`Magazyn_artefaktow_wstrzykiwany_jest_zawsze_pod_kluczem_trwalym`, bo pominięty atrybut nie psuje
niczego, co widać — aż do upływu retencji.

### Zapis: presigned PUT, nie endpoint modułu

`WriteAsync` przyjmuje zawartość **od producenta wewnątrz procesu**. Dla pliku przychodzącego
z przeglądarki to zły kształt: żądanie HTTP trzymane otwarte na czas transferu i drugi komplet
bajtów przechodzący przez proces .NET bez żadnego pożytku. Dlatego doszło
`CreateUploadTicketAsync`, a wgrywanie jest **dwukrokowe**:

```text
1. getMultimediaUploadTickets  → N adresów PUT (bilety) celujących w staging/{uuid}
2. PUT prosto do magazynu       ← bajty NIE przechodzą przez serwis
3. multimedia/create            → walidacja + promocja staging/ → assets/ + wpisy w katalogu
                                  (synchronicznie!), zwraca ich uuidy
4. product/batch-add-multimedia → dopięcie zasobów do produktów
```

Krok 3 jest **jedynym poza eksportem zapisem, który nie idzie przez zadanie masowe**, i decyduje
o tym krok 4: dopięcie waliduje istnienie zasobów, więc klient musi znać ich uuidy natychmiast.
Gdyby rejestracja zwracała `jobUuid`, trzeba by czekać na zakończenie tamtego zadania, zanim
w ogóle da się zlecić dopięcie. Pełne uzasadnienie siedzi w `MultimediaCreateCommandEndpoint`.

Podpisujemy **sam adres, bez nagłówków**. Podpisany `Content-Type` musiałby przyjechać
z przeglądarki co do znaku, a ta dokłada do `PUT`-a własne nagłówki — każda rozbieżność kończy
się odrzuceniem podpisu przez magazyn.

> **Czego ta droga nie daje.** Serwis nie widzi bajtów, więc w chwili wydania biletu nie wie ani
> co zostanie wgrane, ani czy cokolwiek. Rozmiar i typ MIME odczytujemy **po fakcie**, w kroku 3,
> ze `StatObject` — i to one, a nie deklaracja klienta, trafiają do agregatu. Artefakt, którego
> w magazynie nie ma, odrzuca komendę: wpis wskazujący na pustkę byłby w UI zepsutą miniaturką
> bez wyjaśnienia.
>
> **Obiekt wgrany, po którym nigdy nie przyszła komenda, sprząta magazyn — nie worker.** Bilet
> celuje w `staging/{uuid}`, komenda promuje obiekt do `assets/{uuid}` (`CopyObject` po stronie
> magazynu), a reguła lifecycle założona na samym `staging/` kasuje to, co nigdy nie zostało
> potwierdzone. Osierocony obiekt umiera więc z konfiguracji magazynu, a nie z kodu, który mógłby
> się pomylić — [`media-storage.md` §3 i §4a](./media-storage.md#3-cykl-życia-obiektu-w-kubełku--staging-i-assets).

### Odczyt: proxy przez moduł, nie presigned

Tabela z sekcji 6 rozstrzyga to inaczej niż przy eksportach, i celowo. Presigned URL żyje minuty
i jest bearer-owy — dla pliku pobieranego raz, po kliknięciu, to zaleta; dla zdjęcia
renderowanego w galerii wada podwójna: adres wygasa w trakcie przeglądania listy, a każda
miniaturka wymaga wcześniejszej wymiany identyfikatora na link. Dlatego zawartość wydaje
`GET multimedia/content/{uuid}` — adres trwały, uprawnienie sprawdzane przy każdym żądaniu,
odwołanie dostępu działa natychmiast.

Adresowany jest **uuid zasobu, nie artefaktu**: tożsamość obiektu w magazynie nie wychodzi poza
backend, a `MultimediaDto` nie niesie ani jej, ani żadnego adresu. Odpowiedź ma
`Cache-Control: private, max-age=86400, immutable`, bo zawartość pod danym uuid nigdy się nie
zmienia — podmiana pliku jest nowym zasobem, nie edycją istniejącego.

Konsekwencja dla frontendu: `<img src>` nie dołącza tokenu, więc obrazek pobiera się przez
`HttpClient` i ląduje w `blob:`-URL-u — patrz
[`docs/frontend/multimedia.md`](../frontend/multimedia.md).

---

## 10. Zobacz też

- [Magazyn plików](./media-storage.md) — kubełki per moduł, poświadczenia, prefiksy, sprzątanie;
  rozstrzygnięcia obejmujące wszystkie pliki, nie tylko eksporty
- [Nazewnictwo komend i endpointów](./endpoint-naming.md) — dlaczego to `Create`, a nie `Exec`
- [Operacje masowe](./bulk-commands.md) — `job`/`job_item`, `BulkCommandRunner`, `retry-failed`
- [Realtime SignalR](./realtime-signalr.md) — kanały `jobs` i `agg:`, grupy
- [Powiadomienia na froncie](../frontend/notifications.md) — toast, dzwonek, ponowne pobranie
