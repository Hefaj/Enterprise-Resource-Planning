# Magazyn plików — gdzie żyją, kto ma do nich dostęp, kto po nich sprząta

**Stan: 🟡 wgrywanie i miniaturki potwierdzone na żywym MinIO, reszta nie.** Legenda znaczników —
[`architecture.md`](./architecture.md#1-stan-wdrożenia). Wdrożone są wszystkie pozycje
z [§6](#6-stan-wdrożenia) plus miniaturki z [§8](#8-warianty-pochodne--miniaturki); testy
jednostkowe i architektoniczne przechodzą. Przebieg end-to-end na MinIO **odbył się dla ścieżki
wgrywania i wariantów pochodnych** (i wywrócił dwa nieme braki w podpięciu — patrz
[§6](#6-stan-wdrożenia)); co nadal czeka na pierwsze uruchomienie, wylicza
[§7](#7-co-zostało-do-weryfikacji).
Ten dokument **zastępuje** rozstrzygnięcia z [`exports-artifacts.md`](./exports-artifacts.md)
§5 i §9 w tych punktach, w których się z nimi rozjeżdża (układ kubełków, poświadczenia,
sprzątanie, rola DMS).

Podział zakresów między tymi dwoma dokumentami:

| | [`exports-artifacts.md`](./exports-artifacts.md) | ten dokument |
|---|---|---|
| Odpowiada na | jak powstaje plik produkowany przez system i jak użytkownik się o nim dowiaduje | gdzie pliki leżą, kto je widzi, kiedy znikają |
| Zakres | jeden producent (`ExportRun`, `job.kind = Reduce`) | wszystkie pliki wszystkich modułów |

---

## 1. Biblioteka, nie mikroserwis

**Decyzja: nie powstaje mikroserwis do zarządzania multimediami. Każdy moduł rozmawia z MinIO sam,
przez wspólną bibliotekę `Erp.BuildingBlocks.Artifacts`.**

Argument rozstrzygający jest jeden i dotyczy sprzątania: **centralny serwis plików nie umie
posprzątać po sobie.**

Żeby usunąć plik, trzeba wiedzieć, czy ktoś go jeszcze używa. Referencja — `product_multimedia`
dziś, `invoice_attachment` jutro — żyje w schemacie modułu biznesowego, bo jest częścią jego
modelu. Centralny serwis musiałby trzymać rozproszony licznik referencji utrzymywany zdarzeniami,
a licznik *eventually consistent* to licznik, który w oknie opóźnienia kasuje żywe dane. Nie ma
tu bezpiecznego wariantu: albo nie kasuje nigdy, albo czasem kasuje za wcześnie.

Wniosek działa w obie strony i dlatego jest projektowy, a nie preferencyjny: **jeżeli plik ma być
usuwany na podstawie referencji, rekord pliku musi leżeć w tej samej granicy transakcyjnej co
referencja.** To wymusza „moduł biznesowy jest właścicielem pliku" i zamyka sprawę.

Reszta argumentów prowadzi tam samo:

| | Osobny mikroserwis | Biblioteka (wybrane) |
|---|---|---|
| Sprzątanie | rozproszony licznik referencji, kasujący w oknie opóźnienia | referencja i rekord w jednej transakcji |
| Autoryzacja | musiałby replikować ACL domenową albo odpytywać moduł zwrotnie | moduł już wie, kto może zobaczyć fakturę |
| Bajty | dodatkowy hop, albo i tak presigned — czyli serwis niepotrzebny na ścieżce gorącej | prosto do MinIO |
| Spójność z resztą | wyłamuje się: jednostką współdzielenia jest tu `building-blocks`, nie serwis | jak `Erp.BuildingBlocks.{Jobs,Messaging,Validation}` |

### DMS to moduł biznesowy, nie magazyn plików

`IArtifactStore` nosi dziś komentarz „docelowo to jest zadanie modułu DMS". **To zdanie jest do
wykreślenia** — miesza dwie rzeczy, które muszą zostać rozdzielone:

| | Co to jest | Czy powstaje |
|---|---|---|
| **DMS jako moduł biznesowy** | faktury, umowy, obieg dokumentu, wersjonowanie, retencja księgowa | **tak** — z własnym schematem, agregatami i uprawnieniami, jak każdy moduł |
| **DMS jako magazyn plików dla innych modułów** | „wszystkie pliki systemu trzyma DMS, reszta go odpytuje" | **nie** — to jest centralny serwis z akapitu wyżej |

Faktura należy do DMS-u dlatego, że *faktura* jest pojęciem DMS-u — nie dlatego, że DMS jest
„od plików". Zdjęcia produktów zostają w Catalogu na zawsze, również po tym, jak DMS dostanie
backend.

### Współdzielenie plików między modułami

Marketing chce użyć zdjęcia produktu. To się robi **w przeglądarce, nie na backendzie**: front
i tak woła każdy mikroserwis bezpośrednio (brak BFF — [`architecture.md`](./architecture.md)),
więc Marketing trzyma u siebie `uuid` zasobu z Catalogu, a `<img>` bierze zawartość z
`GET catalog/multimedia/content/{uuid}`, za uprawnieniem Catalogu. Zero sprzężenia backendów,
zero kopii bajtów, uprawnienie sprawdzane tam, gdzie mieszka model.

Czego **nie** robić: kopiowania obiektu do kubełka Marketingu (druga kopia bajtów i drugie źródło
prawdy o tym samym pliku) ani czytania cudzego kubełka wprost (patrz §2.3 — po wdrożeniu polityk
to i tak przestanie być możliwe).

---

## 2. Trzy osie separacji

Dziś całą separację niesie jedna oś — retencja, przez dwa kubełki `erp-artifacts` / `erp-media`.
To za mało i nie ta oś. Osie są trzy, **niezależne**, i mylenie ich ze sobą jest głównym źródłem
błędów w tym obszarze.

| Oś | Odpowiada na pytanie | Mechanizm |
|---|---|---|
| A | Czy **ten użytkownik** może zobaczyć **ten plik**? | uprawnienie na endpointcie modułu |
| B | Jak długo plik żyje i jakie ma gwarancje? | kubełek per moduł i klasa cyklu życia |
| C | Czy **ten serwis** może w ogóle dosięgnąć tych bajtów? | klucz MinIO per serwis + polityka |

### 2.1 Oś A — uprawnienie na endpointcie

Poza serwisem-właścicielem **nikt nigdy nie czyta z MinIO**. Przeglądarka nie dostaje poświadczeń
do kubełka, a `artifactUuid` nie opuszcza backendu — zasób jest adresowany uuid-em agregatu, nie
obiektu w magazynie. To już jest zrobione dobrze w `GetMultimediaContentEndpoint` i zostaje bez
zmian.

Separacja uprawnień sprowadza się więc do zwykłej konwencji `{moduł}.{zasób}.{akcja}`:

```
GET catalog/multimedia/content/{uuid}  → catalog.dictionary.read
GET dms/invoice/content/{uuid}         → dms.invoice.read   + wpis audytowy pobrania
```

Inny serwis, inny kod w [`Permissions`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/Permissions.cs),
inna trasa. Faktury dostają dodatkowo audyt każdego pobrania — i **to** jest realna różnica między
fakturą a zdjęciem produktu. Z magazynem nie ma ona nic wspólnego.

> **Nigdy nie próbuj robić separacji uprawnień politykami kubełka.** Polityka S3 odpowiada na
> pytanie „czy ten *serwis* może czytać ten kubełek", a nie „czy ten *użytkownik* może zobaczyć
> tę fakturę". To dwa różne pytania i tylko drugie interesuje użytkownika. Polityka jest osią C
> i robi coś innego.

### 2.2 Oś B — kubełek per moduł i klasa cyklu życia

```
erp-catalog-artifacts     eksporty, raporty      lifecycle: RetentionDays
erp-catalog-media         zdjęcia produktów      bez lifecycle
erp-dms-artifacts         raporty DMS            lifecycle: RetentionDays
erp-dms-media             faktury, umowy         bez lifecycle + versioning + object-lock
erp-marketing-artifacts   …
erp-marketing-media       …
```

Nazwa: `erp-{moduł}-{klasa}`, klasa ∈ `artifacts` (wygasające, produkowane przez system) |
`media` (trwałe, wgrywane przez użytkownika). Podział na te dwie klasy zostaje bez zmian — jest
dobry i uzasadniony w [`exports-artifacts.md` §9](./exports-artifacts.md#9-zawartość-wgrywana-przez-użytkownika--drugi-kubełek-druga-droga).
Zmienia się to, że **kubełek jest per moduł, a nie wspólny**.

Cztery powody, każdy wystarczający sam z siebie:

1. **Reguła lifecycle jest własnością kubełka i ma pusty prefiks**, a `ArtifactBucketInitializer`
   zakłada ją **przy każdym starcie modułu**. Dwa moduły z różnym `RetentionDays` na jednym
   kubełku nadpisują sobie regułę nawzajem przy każdym restarcie — cicho, bez błędu, z objawem
   widocznym dopiero po upływie czyjejś retencji.
2. **Object-lock, versioning i quota to ustawienia kubełka, nie obiektu.** Faktury prawdopodobnie
   potrzebują WORM i retencji księgowej liczonej w latach; zdjęcia produktów nie. Nie da się tego
   ustawić per plik.
3. **Promień rażenia** — osobny kubełek jest warunkiem koniecznym osi C. Bez niego polityka nie ma
   czego rozdzielić.
4. **Ops** — metryki, backup i limity per moduł, zamiast jednego worka.

> **Zrobione.** `ErpArtifactOptions` nie ma już domyślnej nazwy kubełka: magazyny leżą
> w słowniku `Stores`, a `RequireStore(klucz)` rzuca czytelnym wyjątkiem, gdy konfiguracja
> nie ma wpisu, po który sięga kod. Domyślny kubełek „na wszelki wypadek" byłby dokładnie tym
> cichym rozjazdem, przed którym broni ten podział. Catalog ma skonfigurowane
> `erp-catalog-artifacts` i `erp-catalog-media`; kolejny moduł z plikami dokłada własną parę
> i nie ma jak wejść w cudzy kubełek przez pomyłkę.

### 2.3 Oś C — klucz MinIO per serwis

**Tego nie ma dziś wcale.** Wszystkie serwisy chodzą na koncie root (`erp`/`erp12345`),
a katalog [`backend/minio/policies/`](../../backend/minio/policies/) istnieje i jest pusty —
kierunek był w planie, tylko nie został wykonany.

Każdy serwis dostaje własnego użytkownika MinIO z polityką zawężoną do swoich kubełków:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::erp-catalog-artifacts", "arn:aws:s3:::erp-catalog-artifacts/*",
      "arn:aws:s3:::erp-catalog-media",     "arn:aws:s3:::erp-catalog-media/*"
    ]
  }]
}
```

Zakładane jednorazowym kontenerem `minio-init` w
[`docker-compose.yml`](../../backend/docker-compose.yml) (`mc admin user add` + `mc admin policy
attach`), obok samego MinIO — tak samo jak kubełek zakłada się kodem, a nie instrukcją dla
developera.

Co to kupuje: **nawet błąd w Catalogu — pomylone `artifactUuid`, wstrzyknięty nie ten magazyn,
literówka w konfiguracji — nie może przeczytać faktury z DMS-u.** Dziś może, bo ma roota. To
jedyna warstwa separacji, która trzyma przy pomyłce programisty, a nie tylko przy poprawnym
kodzie; pozostałe dwie zakładają, że kod robi to, co miał robić.

### 2.4 Kształt konfiguracji

Obecna para `BucketName` + `MediaBucketName` z jednym `RetentionDays` nie rozciąga się na moduł
z trzecią klasą plików ani na różne retencje. Zamiast dokładać kolejne pola — słownik magazynów
po kluczu, tym samym, którym konsument je wstrzykuje:

```json
"Artifacts": {
  "Endpoint": "localhost:9100",
  "AccessKey": "catalog",
  "SecretKey": "…",
  "UseSsl": false,
  "Stores": {
    "transient": { "BucketName": "erp-catalog-artifacts", "RetentionDays": 7 },
    "media":     { "BucketName": "erp-catalog-media" }
  }
}
```

Rejestracja w `AddErpArtifacts` leci pętlą po `Stores`; `RetentionDays` obecny → zakładamy regułę
lifecycle, nieobecny → nie zakładamy. Dzisiejsza zasada zostaje nietknięta i jest dobra:
**rejestracja bezkluczowa to magazyn wygasający, zawartość trwała prosi o siebie jawnie**
(`[FromKeyedServices(ArtifactStoreKeys.Media)]`). Odwrotny domyślny kończyłby się cichym
wydłużeniem życia eksportów zamiast głośnym błędem, a testu
`Magazyn_artefaktow_wstrzykiwany_jest_zawsze_pod_kluczem_trwalym` nie ruszamy.

---

## 3. Cykl życia obiektu w kubełku — `staging/` i `assets/`

Klucz obiektu jest dziś płaski (`ObjectName(uuid) => uuid.ToString("N")`). Wprowadzamy prefiks,
bo on jest mechanizmem sprzątania z §4a:

```
staging/{uuid}    ← tu celuje presigned PUT           lifecycle: expire after 1 day
assets/{uuid}     ← tu ląduje potwierdzony plik       bez lifecycle (kubełek media)
```

Przebieg wgrywania zyskuje jeden krok, niewidoczny dla klienta:

```text
1. getMultimediaUploadTickets  → N adresów PUT celujących w staging/{uuid}
2. PUT prosto do magazynu       ← bajty NIE przechodzą przez serwis
3. multimedia/create            → StatObject (rozmiar, typ) + PROMOCJA staging/ → assets/
                                  + wpisy w katalogu, synchronicznie, jedna transakcja
4. product/batch-add-multimedia → dopięcie zasobów do produktów (zwykłe zadanie masowe)
```

Promocja to server-side `CopyObject` + `RemoveObject` na źródle — **bajty nie przechodzą przez
proces .NET**. W `IArtifactStore` dochodzi jedna metoda:

```csharp
/// <summary>Przenosi potwierdzony obiekt z prefiksu postojowego do docelowego.</summary>
Task PromoteAsync(Guid artifactUuid, CancellationToken cancellationToken);
```

Reguła lifecycle na kubełku `media` przestaje mieć pusty prefiks — obejmuje wyłącznie `staging/`.
Kubełek `artifacts` zostaje jak jest: cały jest wygasający, bo cały jest z definicji tymczasowy.

---

## 4. Cztery wycieki, cztery różne mechanizmy

„Worker chodzący w tle i kasujący multimedia bez referencji" to jedno narzędzie na cztery różne
problemy — i akurat najbardziej ryzykowne z możliwych, bo nieodwracalne i działające na
heurystyce. Rozbite na przypadki, trzy z czterech nie potrzebują workera w ogóle.

| # | Co wycieka | Mechanizm | Worker? |
|---|---|---|---|
| a | obiekt wgrany, po którym nie przyszła komenda | lifecycle na prefiksie `staging/` | nie |
| b | agregat skasowany, obiekt został | outbox + konsument z ponowieniami | nie |
| c | zasób, któremu zniknęła ostatnia referencja | jawna własność + kaskada w transakcji | nie |
| d | rozjazd baza ↔ kubełek po nietypowej awarii | audytor, rzadko, dry-run | **tak, jeden** |

### 4a. Obiekt wgrany, po którym nie przyszła komenda

Bilet wydany, przeglądarka zrobiła `PUT`, użytkownik zamknął modal przed krokiem 3. Obiekt jest
w kubełku, w bazie nie ma o nim ani jednego wiersza — więc **nic w systemie nie wie, że istnieje**.
Dziś to jedyny wyciek jawnie przyznany jako nieobsłużony (patrz też
[`docs/frontend/multimedia.md` §2](../frontend/multimedia.md)).

**Rozwiązanie: prefiks postojowy z §3, czyli zero kodu sprzątającego.** Osierocony obiekt nigdy
nie opuszcza `staging/` i umiera z reguły kubełka. Mechanizm, który nie ma jak mieć buga i nie ma
jak skasować czegokolwiek żywego, bo o istnieniu żywych plików w ogóle nie wie — patrzy wyłącznie
na prefiks i wiek.

Odrzucona alternatywa: tabela `pending_upload` zapisywana przy wydaniu biletu i worker kasujący
niepotwierdzone wpisy po TTL. Robi to samo, kosztem tabeli, workera i trzeciego stanu do
utrzymania w zgodzie. Magazyn potrafi to sam.

### 4b. Agregat skasowany, obiekt został

Baza i MinIO nie są w jednej transakcji, więc zawsze istnieje moment, w którym wiersz zniknął,
a `DeleteObject` padł albo się nie wykonał.

**Rozwiązanie: transactional outbox, nie worker** — machineria już jest
([`events-outbox.md`](./events-outbox.md)). Ta sama transakcja, która usuwa `MultimediaAsset`,
zapisuje kopertę `MultimediaAssetDeleted { ArtifactUuid }`; konsument woła `DeleteAsync`
z ponowieniami. Semantyka at-least-once jest tu dokładnie właściwa, bo usunięcie jest idempotentne:
`MinioArtifactStore.DeleteAsync` świadomie łyka `ObjectNotFoundException`.

> **Dziś ten wyciek nie istnieje, bo nie ma czym go wywołać:** w module nie ma ani jednej komendy
> usuwającej multimedia. To nie jest zaleta — oznacza, że wgranego pliku nie da się usunąć wcale.
> Komenda usuwająca i ten outbox powstają razem, inaczej pierwszy `Remove` od razu zaczyna
> zostawiać śmieci.

### 4c. Zasób, któremu zniknęła ostatnia referencja

Tu jest właściwe pytanie projektowe i tu domyślna odpowiedź („skasuj, jak nikt nie wskazuje")
jest zła.

Kod już tę sprawę rozstrzygnął, tylko nie wprost: `MultimediaAsset` jest `AggregateRoot` z własnym
uuid, własnymi endpointami, własną sygnaturą SignalR i własnym orkiestratorem na froncie. To nie
jest pole produktu — to jest **biblioteka mediów**. A w bibliotece „nikt tego teraz nie używa"
nie znaczy „to śmieć": użytkownik, który odpina zdjęcie od produktu, żeby przepiąć je do innego,
nie prosi o skasowanie pliku.

Worker kasujący po zerowej referencji **cicho usuwa dane użytkownika na podstawie heurystyki,
w oknie między dwoma jego kliknięciami**. Nieodwracalnie i niewidocznie — najgorszy możliwy tryb
awarii.

**Rozwiązanie: zamodelować własność jawnie, zamiast zgadywać ją z licznika.** Na `MultimediaAsset`
dochodzi `Ownership`:

| `Ownership` | Znaczenie | Kiedy znika |
|---|---|---|
| `Owned` | plik wgrany w kontekście jednego właściciela, nie do ponownego użycia | **kaskadą w tej samej transakcji**, która usuwa ostatnią referencję |
| `Library` | pozycja biblioteki mediów, wielokrotnego użytku | wyłącznie jawną komendą użytkownika |

Dla `Owned` usunięcie jest **kaskadą w transakcji, nie zamiataniem**: deterministyczne,
natychmiastowe, bez okna wyścigu, i wpada w mechanizm 4b razem z outboxem. Dla `Library` licznik
referencji służy do **zablokowania** usunięcia („używane przez 12 produktów — odepnij najpierw"),
a nie do jego wywołania; licznik jedzie w `MultimediaDto`, żeby UI mógł to pokazać przed
kliknięciem, a nie po.

Ta sama zasada dotyczy faktur w DMS: faktura jest agregatem z własnym cyklem życia i retencją
prawną. Nie kasuje się jej dlatego, że w danej chwili nikt na nią nie wskazuje.

### 4d. Rozjazd baza ↔ kubełek

Po domknięciu 4a–4c zostaje wąski margines: obiekt w kubełku, którego nie tłumaczy żaden
z powyższych mechanizmów, bo coś się wywróciło w nietypowym momencie. **To jedyne miejsce na
workera — i jest to audytor, nie garbage collector.**

Zasady, wszystkie konieczne:

- **rzadko** — raz na tydzień, poza godzinami szczytu; nie co minutę i nie w pętli;
- **próg wieku** — dotyka wyłącznie obiektów starszych niż np. 7 dni, żeby nie wejść w wyścig
  z trwającym uploadem ani z niezatwierdzoną jeszcze transakcją;
- **kierunek: od magazynu do bazy** — listuje `assets/`, sprawdza każdy klucz po indeksie
  `multimedia.artifact_uuid`, który **jest już założony** dokładnie pod to
  ([`MultimediaAssetConfiguration`](../../backend/modules/Catalog/Catalog.Infrastructure/Persistence/Configurations/Multimedia/MultimediaAssetConfiguration.cs));
- **domyślnie dry-run** — raportuje do logu i metryki; kasowanie włącza się jawnie i dopiero po
  tym, jak przez kilka przebiegów raport jest pusty albo w całości zrozumiały;
- **w serwisie-właścicielu** — tylko Catalog wie, co jest referencją w Catalogu. To ta sama
  racja, która w §1 zabija centralny serwis plików;
- **pod dzierżawą `catalog:media-reconciliation`** (advisory lock Postgresa) — instancja, która
  jej nie dostanie, pomija przebieg i czeka na następny cykl. Pominięcie nic tu nie kosztuje, bo
  cykl liczy się w godzinach; bez dzierżawy dwie instancje listowałyby ten sam kubełek i kasowały
  te same obiekty. Patrz [`architecture.md` §7](./architecture.md#7-wieloinstancyjność--założenia-zdjęte).

> **Jak czytać jego wynik.** Jeżeli 4a–4c działają, audytor przez większość życia systemu nie
> znajduje niczego — i o to chodzi. Worker, który regularnie coś kasuje, jest **objawem**, że
> któryś z pozostałych trzech mechanizmów jest zepsuty, a nie dowodem, że sprzątanie działa.

---

## 5. Dziury, które ten projekt zostawia otwarte

Trzy pozycje niezależne od powyższych rozstrzygnięć, warte zapisania, żeby nie zostały przeoczone:

1. **Brak limitu rozmiaru na presigned PUT.** Kto ma `catalog.multimedia.update`, może wgrać plik
   dowolnej wielkości. Presigned `PUT` nie da się ograniczyć nagłówkiem `content-length-range` —
   to potrafi wyłącznie presigned `POST` z polityką. Najtańsze domknięcie: w kroku 3 sprawdzić
   `StatObject().Size` i odrzucić żądanie, kasując obiekt ze `staging/`, jeżeli przekracza limit.
   Bajty są wtedy już na dysku magazynu, ale nigdy nie zostają promowane. Docelowo — presigned `POST`.
2. **Brak skanowania antywirusowego** treści wgrywanej przez użytkownika. W systemie, który ma
   trzymać faktury i załączniki od kontrahentów, to jest pozycja do świadomej decyzji, a nie do
   przeoczenia. Naturalne miejsce: konsument zdarzenia w kroku 3, **przed** promocją ze `staging/`
   do `assets/` — plik odrzucony nigdy nie staje się zasobem, a `staging/` i tak go po dobie skasuje.
3. **`OpenAsync` przepisuje każdy obiekt przez plik tymczasowy** — bo sygnatura zwraca `Stream`,
   a `GetObjectAsync` oddaje zawartość callbackiem. Dla galerii to pełny round-trip po dysku na
   każdą miniaturkę. Domknięcie: `Task ReadToAsync(Guid, Stream target, CancellationToken)`
   w `IArtifactStore`, wpinane wprost w `HttpContext.Response.Body`. Plik tymczasowy zostaje
   wyłącznie po stronie **zapisu**, gdzie ma powód (`PutObject` potrzebuje rozmiaru z góry).

---

## 6. Stan wdrożenia

| # | Zmiana | Stan | Gdzie |
|---|---|---|---|
| 1 | Kubełki per moduł; `Stores` jako słownik (§2.2, §2.4) | ✅ | [`ErpArtifactOptions`](../../backend/building-blocks/Erp.BuildingBlocks.Artifacts/ErpArtifactOptions.cs), [`ErpArtifactExtensions`](../../backend/building-blocks/Erp.BuildingBlocks.Artifacts/ErpArtifactExtensions.cs) |
| 2 | Klucz MinIO per serwis, polityki, `minio-init` (§2.3) | ✅ | [`minio/policies/`](../../backend/minio/policies/), [`docker-compose.yml`](../../backend/docker-compose.yml) |
| 3 | Prefiksy `staging/`/`assets/`, `PromoteAsync`, lifecycle (§3, §4a) | ✅ | [`MinioArtifactStore`](../../backend/building-blocks/Erp.BuildingBlocks.Artifacts/MinioArtifactStore.cs) |
| 4 | Komenda usuwająca + outbox `ArtifactDeletionRequested` (§4b) | ✅ | `MultimediaRemoveCommand*`, [`ArtifactDeletionRequestedHandler`](../../backend/modules/Catalog/Catalog.Infrastructure/Consumers/ArtifactDeletionRequestedHandler.cs) |
| 5 | `Ownership` + licznik referencji w `MultimediaDto` + kaskada dla `Owned` (§4c) | ✅ | [`MultimediaAsset`](../../backend/modules/Catalog/Catalog.Domain/Aggregates/Multimedia/MultimediaAsset.cs), `MultimediaCascade`, `ProductRemoveMultimediaCommand*`, `ProductSetMultimediaCommand*` |
| 6 | Audytor rozjazdu, dry-run (§4d) | ✅ | [`MediaReconciliationService`](../../backend/modules/Catalog/Catalog.Infrastructure/Jobs/MediaReconciliationService.cs) |
| 7 | Limit rozmiaru, `ReadToAsync` (§5) | ✅ | `MultimediaOptions`, `GetMultimediaContent` |
| 8 | Skan antywirusowy (§5) | 📐 | decyzja nie zapadła |
| 9 | Miniaturki i podglądy (SkiaSharp, outbox, endpoint wariantu) — §8 | ✅ | `ImageDerivativeGenerator`, `ArtifactDerivativesRequestedHandler`, `GetMultimediaVariantEndpoint`; przebieg end-to-end na żywym MinIO potwierdzony — patrz niżej |
| 10 | Ponowne zlecenie wariantów (`multimedia/batch-exec-generate-derivatives`) — §8 | ✅ | `MultimediaExecGenerateDerivativesCommand*`, akcja „Generuj miniatury" w panelu multimediów |

### Dwie rzeczy, które trzymały pozycję 9 martwą

Generator był poprawny od początku (testy przechodziły), ale **kod nigdy się nie wykonywał**.
Blokowały go dwa niezależne braki w podpięciu — oba nieme, żaden nie dawał błędu:

1. **Catalog nie miał `Messaging:ListenQueueName`**, więc nie był związany z wymianą `erp.events`.
   Fanout kopiuje kopertę wyłącznie do związanych kolejek — moduł nie dostawał nawet tego, co sam
   opublikował. Publikacja się udawała, outbox pustoszał, dead letters były puste.
2. **Konsumenci przyjmowali `IServiceProvider`** w sygnaturze, żeby sięgnąć po kluczowany
   `IArtifactStore`. Wolverine 6 odrzuca takie sygnatury (`ServiceLocationPolicy.NotAllowed`) —
   handler nie powstawał, a koperta lądowała jako „No known handler". Dotyczyło to tak samo
   `ArtifactDerivativesRequestedHandler`, jak i `ArtifactDeletionRequestedHandler`, czyli
   **pozycja 4 tej tabeli też nigdy nie zadziałała**. Rozwiązanie: `IArtifactStoreResolver`.

To zostawiło osobny dług, który zamyka dopiero pozycja 10: zlecenie generowania wychodzi
**raz**, przy rejestracji pliku, więc zasoby wgrane w czasie, gdy konsument był martwy, nie
miały jak wariantów dostać. Stąd komenda `Exec` ponawiająca zlecenie dla wskazanych zasobów —
bez niej jedynym sposobem nadrobienia byłoby wgranie plików od nowa.

Pomiary z przebiegu potwierdzającego: wariant gotowy **0,25 s** po rejestracji dla zdjęcia
12 Mpx i **1,6 s** dla 90 Mpx. To szybciej, niż użytkownik zdąży zatwierdzić modal — kafelek
pojawia się od razu z miniaturką, a zaślepka typu pliku jest w praktyce ścieżką awaryjną,
nie normalnym etapem. Podmiana przez `AggregateChanged` → SignalR działa i została sprawdzona
na biernej karcie przeglądarki: jedno odpytanie po pchnięciu, bez pętli odpytującej.

### Jak domknięta jest kaskada z pozycji 5

Wyzwalaczem jest odpięcie referencji, którego wcześniej w module nie było: komendy
`ProductRemoveMultimediaCommand` (zdejmuje wskazane pliki) i `ProductSetMultimediaCommand`
(podmienia całą galerię; pusta lista ją czyści). Obie metody agregatu zwracają **zasoby faktycznie
odpięte**, a handler przekazuje tę listę do `IMultimediaCascade` — jeszcze przed commitem, w tej
samej transakcji.

Kaskada usuwa wyłącznie zasoby `Owned`, którym po tej operacji nie zostaje żadna referencja,
i wypuszcza dla nich `ArtifactDeletionRequested` przez outbox — tak samo jak jawne
`MultimediaRemoveCommand` (§4b). Pozycje `Library` zostają nietknięte, także przy zerowym liczniku:
to jest dokładnie ten wariant, który §4c odrzuca.

Jedna rzecz jest tu nieoczywista i dlatego ma własną metodę zapytania. Licznik referencji jedzie
z bazy, w której odpięte przed chwilą wiersze `product_multimedia` **jeszcze są** — transakcja nie
jest zatwierdzona. Zwykłe `CountReferencesAsync` pokazałoby stan sprzed odpięcia i kaskada nigdy
by nie zadziałała, więc kaskada pyta `CountReferencesExceptAsync(uuids, productUuid)`: referencje
z pominięciem produktu, który je właśnie stracił. To jest stan po zapisie, bez zaglądania
w ChangeTracker z warstwy, która o EF nie wie. Zasób `Owned` z definicji ma jednego właściciela,
więc wykluczenie jednego produktu wystarcza także wtedy, gdy w tym samym chunku odpina się
kilka celów.

Granice kaskady są przypięte testami (`MultimediaCascadeTests`, `ProductMultimediaLinkTests`) —
to jedyne miejsce, w którym plik użytkownika znika bez jawnej komendy „usuń zasób”.

---

## 7. Co zostało do weryfikacji

Ścieżka wgrywania i miniaturek przeszła już na żywym MinIO (konto `catalog`, nie root):
bilet → `PUT` do magazynu → rejestracja → promocja do `assets/` → warianty pod
`derivatives/{uuid:N}/{thumb|preview}` → endpoint wariantu → miniaturka w tabeli. Zamknięte tym
samym przebiegiem: **`minio-init` zakłada konto i politykę**, **`CopyObject` przy promocji** oraz
**Skia na maszynie deweloperskiej**.

Nadal do sprawdzenia:

- **Reguła lifecycle z dwoma wpisami naraz** (`erp-staging-cleanup` + `erp-artifact-retention`
  na kubełku `transient`) — kubełek `media` nie ma retencji, więc przebieg z multimediami tego
  nie dotknął.
- **Natywna Skia w obrazie kontenerowym.** Lokalnie ładuje się poprawnie, ale
  `SkiaSharp.NativeAssets.Linux.NoDependencies` musi jeszcze trafić do obrazu wdrożeniowego.
  Brak `libSkiaSharp.so` nie objawia się przy starcie — dopiero przy pierwszym wgranym zdjęciu,
  w konsumencie działającym w tle.
- ~~**Kasowanie plików**~~ — **zweryfikowane end-to-end** (25.08.2026): „Usuń z biblioteki"
  na stronie `/catalog/multimedia` → `multimedia/batch-remove` → zadanie `Completed` 1/1 →
  wiersz zniknął z `catalog.multimedia`, a konsument `ArtifactDeletionRequested` usunął
  z kubełka obiekt `assets/{uuid:N}` (18 MB). Sprawdzona jest też odmowa: ten sam zasób,
  póki wskazywał na niego produkt, odpadł jako `job_item` z `multimedia_still_referenced`,
  nie wywracając zadania.
- ~~**Nadrabianie wariantów dla starych zasobów**~~ — **zweryfikowane end-to-end**: „Generuj
  miniatury" → `multimedia/batch-exec-generate-derivatives` → `derivatives/{uuid:N}/{thumb,preview}`
  w kubełku, `derivatives_generated_at` ustawione, a miniaturka pojawiła się w otwartej tabeli
  sama, przez `AggregateChanged` — bez odświeżania strony.
- **Migracja danych deweloperskich**: obiekty sprzed zmiany kluczy leżą pod płaskim `{uuid:N}`,
  a kod adresuje `assets/{uuid:N}`. Kubełki zmieniły też nazwy (`erp-catalog-media` zamiast
  `erp-media`), więc najprościej jest wyczyścić wolumen MinIO i wgrać multimedia od nowa —
  dane są deweloperskie.

### Pułapka środowiskowa: polityka konta MinIO sprzed zmiany nazw kubełków

Na wolumenie założonym przed ujednoliceniem nazw (`erp-catalog-*` zamiast `catalog-*`) konto
`catalog` potrafi mieć **ręcznie dorobioną politykę spoza repozytorium** — u nas była to polityka
`catalog` na `arn:aws:s3:::catalog-*`. Objaw: konsumenci padają na
`AccessDenied ... /erp-catalog-media/`, a serwis nie może nawet założyć kubełka, choć plik
`minio/policies/catalog.json` daje mu na to prawo.

**`minio-init` tego nie naprawi**, i to jest tu rzecz nieoczywista: `mc admin policy attach`
jest w nim celowo osłonięty `|| true` (żeby ponowny start nie wywracał się na już istniejącym
stanie), więc nieudane podpięcie przechodzi bez śladu, a stara polityka zostaje. Naprawa jest
ręczna i jednorazowa:

```bash
mc admin policy create local erp-catalog /policies/catalog.json
mc admin policy detach local catalog --user catalog
mc admin policy attach  local erp-catalog --user catalog
```

Obiekty sprzed zmiany leżą wtedy pod płaskim `{uuid:N}` w starym kubełku i trzeba je przenieść
pod `assets/{uuid:N}` w nowym (albo wyczyścić wolumen — to dane deweloperskie).

### Frontend: kontrakt NSwag jest zregenerowany

Klient w `frontend/libs/modules/catalog/data-access/src/lib/api-client.ts` został wygenerowany
z żywego Catalogu i ma komplet: pola `referenceCount`/`hasDerivatives` w `MultimediaDto`,
`multimedia/batch-remove`, `multimedia/content/{uuid}/{variant}`,
`multimedia/batch-exec-generate-derivatives` oraz `product/batch-remove-multimedia`
i `product/batch-set-multimedia`. `SearchMultimediaRequest` ma też filtry biblioteki mediów
(`fileName`, `mediaType`, `onlyUnreferenced`, `onlyWithoutDerivatives`) — a że ten sam typ jest
filtrem CELU operacji masowej, „usuń wszystkie nieużywane" jest jednym żądaniem, a nie listą
uuidów wyklikaną ręcznie.

**Ręczne dopiski z okresu przejściowego okazały się co do znaku poprawne** — generator zastąpił
je bez różnicy w treści, a cały diff poza dwoma nowymi operacjami to przesortowanie metod.
Obejście po stronie orkiestratora (czytanie nowych pól przez sygnaturę indeksową DTO) zostało
usunięte: `catalog-multimedia.orchestrator.ts` czyta je wprost.

---

## 8. Warianty pochodne — miniaturki

**MinIO nie transformuje obrazów.** To czyste object storage zgodne z S3: przechowuje bajty
i oddaje je w całości. Miniaturki trzeba wyprodukować samemu.

Bez nich komórka tabeli 40×40 pobiera oryginał — zdjęcie 4K to ok. 6 MB, więc lista pięćdziesięciu
wierszy ściąga ~300 MB, a `blob:`-cache przeglądarki (300 pozycji) trzyma to w pamięci karty.
Drugi z tych kosztów jest gorszy i mniej oczywisty.

### Kiedy powstają

```text
multimedia/create → promocja staging/ → assets/ → outbox: ArtifactDerivativesRequested
                                                     ↓ (po zatwierdzeniu transakcji)
                                          ArtifactDerivativesRequestedHandler
                                          → thumb 256 px, preview 1024 px, WebP
                                          → MarkDerivativesGenerated → AggregateChanged
```

**Przez outbox, nie w komendzie.** Skalowanie obrazu 4K to setki milisekund procesora; wykonane
w komendzie rejestrującej przedłużyłoby o tyle wgranie każdej paczki zdjęć — czyli moment, w którym
użytkownik patrzy na modal i czeka. Ten sam mechanizm daje ponowienia i przeżycie restartu.

Oznaczenie rekordu idzie przez `IUnitOfWork`, więc skan ChangeTrackera wypuszcza `AggregateChanged`
na sygnaturze `catalog.multimedia` — **otwarta galeria odświeża się sama** i sięga po miniaturkę,
bez odpytywania w pętli.

### Nadrabianie zaległości

Zlecenie generowania wychodzi **raz** — z komendy rejestrującej plik. Zasób, który to zdarzenie
ominęło (bo konsument był wtedy martwy, bo Skia nie zdekodowała pliku przy pierwszym podejściu,
bo generator jeszcze nie istniał), nie dostanie go już nigdy sam z siebie.

Stąd `multimedia/batch-exec-generate-derivatives` — zwykłe zadanie masowe, które wypuszcza
`ArtifactDerivativesRequested` dla wskazanych zasobów, dokładnie takie samo jak przy rejestracji.
Dalej idzie ta sama ścieżka, więc nie ma tu drugiej implementacji generowania: komenda tylko
ponawia zlecenie.

**Czasownik to `Exec`, nie `Set`** — komenda nie zmienia żadnego plastra stanu agregatu; sam
zasób po jej wykonaniu wygląda tak samo, a różnica pojawia się dopiero w magazynie i dopiero
po zatwierdzeniu transakcji ([`endpoint-naming.md` §5](./endpoint-naming.md#5-exec-i-jego-granica)).
Ma to widoczną konsekwencję w raporcie zadania: **sukces oznacza przyjęcie zlecenia, nie gotową
miniaturkę**. Plik, którego Skia nie zdekoduje, zostawia `succeeded` i ląduje wyłącznie w logu
konsumenta. Gotowe warianty zgłaszają się osobno, przez `AggregateChanged`.

Odmowy są dwie i obie dotyczą pojedynczego elementu paczki: `multimedia_derivatives_unsupported`
(zasób nie jest obrazem z naszego magazynu) i `multimedia_derivative_source_too_large` (oryginał
ponad `MaxDerivativeSourceBytes` — ten sam próg, co przy rejestracji).

Front dodatkowo **odsiewa cele przed wysłaniem**: zasoby, które mają już warianty albo nie są
obrazami, nie trafiają do paczki. Backend odrzuciłby je i tak, ale osobnym `job_item` z błędem —
użytkownik zobaczyłby w raporcie kilkanaście „porażek", z których żadna nie jest jego problemem.

### Gdzie leżą

```
assets/{uuid}                 oryginał
derivatives/{uuid}/thumb      256 px, WebP    ~15 KB
derivatives/{uuid}/preview    1024 px, WebP   ~120 KB
```

Klucz jest wyprowadzony z rodzica, więc **wariant nie ma własnego identyfikatora ani wiersza
w bazie**. Osobny uuid wymagałby tabeli wiążącej go z oryginałem — drugiego źródła prawdy
o tym samym pliku. `DeleteAsync` kasuje warianty jednym listowaniem prefiksu, przed oryginałem
(kolejność uzasadniona w `IArtifactStore`).

Jedyne, co trafia do bazy, to `MultimediaAsset.DerivativesGeneratedAt` → `MultimediaDto.hasDerivatives`.
Bez tej flagi UI musiałby traktować 404 jako stan normalny albo cicho spadać na oryginał — czyli
robić dokładnie to, czemu warianty zapobiegają.

### Decyzje, które warto znać

| Co | Dlaczego tak |
|---|---|
| **SkiaSharp**, nie ImageSharp | ImageSharp od v3 ma Six Labors Split License z progiem przychodowym — ta sama klasa zależności, którą projekt odrzucił przy MassTransit v9 i MediatR v13 ([`architecture.md` §4](./architecture.md#4-decyzje-technologiczne-i-ich-powody)). SkiaSharp to MIT nad Skia na BSD-3. |
| **WebP** | ~30% mniejszy plik przy tej samej jakości; wariantu nie pobiera nikt poza naszym UI, więc zgodność ze starymi przeglądarkami nie jest argumentem. |
| Wariant w **ścieżce**, nie w query | Odpowiedź niesie `immutable`, więc każdy wariant musi mieć własny trwały adres. Query string zachęcałby do dowolnych rozmiarów, a zestaw jest zamknięty — pliki powstają z góry. |
| **404 zamiast oryginału**, gdy wariantu brak | Podstawienie oryginału „żeby coś było" byłoby cichym powrotem do problemu. Klient wie z `hasDerivatives`, kiedy pytać. |
| Orientacja z **EXIF-a przez `SKCodec`** | `SKBitmap.Decode` nie stosuje obrotu z EXIF-a. Bez tego kroku każde zdjęcie z telefonu trzymanego pionowo daje miniaturkę na boku, przy oryginale wyświetlanym poprawnie — objaw wygląda na błąd skalowania, a jest błędem odczytu. |
| Próg `MaxDerivativeSourceBytes` (48 MB) | Rozpakowana bitmapa jest wielokrotnie większa niż plik. Bez progu jeden nietypowy TIFF potrafi wywrócić proces API. Zasób ponad próg dostaje ikonę typu, jak wideo. |

### Czego to nie obejmuje

Pierwsza strona PDF-u i klatka z wideo wymagają innych narzędzi (PDFium, ffmpeg) i są osobną
decyzją. `variant` jest stringiem właśnie po to, żeby `poster` dało się dołożyć bez zmiany
kontraktu. Dziś nie-obrazy dostają w UI ikonę typu pliku.

Zmiana zestawu rozmiarów nie przelicza plików wstecz — `DerivativesGeneratedAt` jest znacznikiem
czasu (a nie flagą) właśnie po to, żeby dało się wtedy wybrać rekordy do ponownego przetworzenia.
Samego backfillu nie ma.

---

## 9. Zobacz też

- [Eksporty i artefakty](./exports-artifacts.md) — jak powstaje plik produkowany przez system,
  `job.kind`, agregat przebiegu, wygasanie razem z wierszem `job`
- [Zdarzenia domenowe i outbox](./events-outbox.md) — mechanizm z §4b
- [Tożsamość i uprawnienia](./identity-authz.md) — katalog uprawnień z §2.1
- [Architektura backendu §7](./architecture.md#7-wieloinstancyjność--założenia-zdjęte) — gdzie trafia
  audytor z §4d
- [Multimedia na froncie](../frontend/multimedia.md) — bilety, `blob:`-URL-e, galeria, miniaturki
