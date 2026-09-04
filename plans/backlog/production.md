---
id: operations.production
title: Wyjście na produkcję — plan wdrożenia
summary: Runbook wdrożenia produkcyjnego, konfiguracji, migracji, backupu i CI/CD.
kind: operations
scope: operations
audience:
  - operations
  - backend
  - agent
triggers:
  - wdrożenie produkcyjne
  - gateway TLS backup lub migracje wdrożeniowe
related: []
---

# Wyjście na produkcję — plan wdrożenia

> **Status:** backlog. Powtarzalny kontrakt wydania opisuje `docs/operations/production.md`.

Wszystko, co powstało do tej pory, chodzi wyłącznie na maszynie deweloperskiej: `dotnet run`
z bind-mountem repozytorium, `nx serve`, `docker compose up` z hasłami `erp/erp` w pliku
wersjonowanym w gicie. Ten dokument jest planem zdjęcia tego założenia — czego brakuje, w jakiej
kolejności to dokładać i po czym poznać, że dana faza jest skończona.

Stan: 📐 **cały dokument jest projektem — nie ma pod nim kodu.** Legenda znaczników jak
w [`architecture.md` §1](../architecture/backend.md#1-stan-wdrożenia).

> **Czym ten dokument nie jest.** Nie jest instrukcją wyboru dostawcy hostingu ani opisem
> konkretnego środowiska. Opisuje, co musi być prawdą o *repozytorium i artefaktach*, żeby
> wdrożenie w ogóle było możliwe — niezależnie od tego, czy celem jest jeden serwer z Dockerem,
> czy klaster Kubernetes. Wybór celu wpływa na fazy A i G, resztę zostawia bez zmian
> ([§10](#10-decyzje-otwarte)).

---

## 1. Punkt wyjścia — co jest, a czego nie ma

Rzecz, którą trzeba powiedzieć wprost, bo zmienia priorytety: **backend jest architektonicznie
gotowy na produkcję i to nie jest przypadek.** Wieloinstancyjność została wdrożona w całości
([`multi-instance.md`](../architecture/multi-instance.md)), zadania masowe i eksporty przeżywają restart
procesu, outbox commituje się w transakcji danych, klucze idempotencji leżą w bazie. Nie brakuje
architektury — brakuje **opakowania i eksploatacji**.

| Obszar | Stan | Uwagi |
|---|---|---|
| Skalowanie poziome serwisów | ✅ | Dzierżawy, `SKIP LOCKED`, rozdział Hub/Relay, backplane — [`multi-instance.md`](../architecture/multi-instance.md) |
| Trwałość zadań i eksportów przy restarcie | ✅ | `job`/`job_item` w bazie, `heartbeat_at`, wznawianie |
| Migracje jako osobny krok wdrożenia | ✅ | `Database:MigrateOnStartup` domyślnie `false` (`ErpDatabaseMigrator`); `true` ustawia wyłącznie `appsettings.Development.json` |
| **Obrazy kontenerów** | 📐 | **Nie ma ani jednego `Dockerfile`** w repozytorium — [§4](#4-faza-a--pakowanie) |
| **CI/CD** | 📐 | Brak `.github/` — [§9](#9-faza-g--cicd) |
| **Zarządzanie sekretami** | 📐 | Hasła w repo: `erp/erp` (Postgres, RabbitMQ), `catalog12345` (MinIO), `admin/admin` (Keycloak) — [§5](#5-faza-b--konfiguracja-i-sekrety) |
| **Konfiguracja frontu poza buildem** | 📐 | Adresy API i manifest federacji zaszyte na `localhost` w czasie kompilacji — [§5.2](#52-frontend--konfiguracja-w-runtime-nie-w-buildzie) |
| **Wspólny origin / gateway** | 📐 | Stąd CORS z `AllowCredentials` i bezwzględny `SIGNALR_HUB_URL`; komentarz w `remote-api.providers.ts` wprost pisze „gatewaya jeszcze nie ma" — [§6](#6-faza-c--jeden-origin-i-tls) |
| **TLS** | 📐 | Wszystko chodzi po `http://`, Keycloak w trybie `start-dev` |
| **Health checks** | 📐 | Nigdzie `AddHealthChecks` — load balancer nie ma po czym poznać, którą instancję wyciąć z rotacji; [`observability.md` §4](observability.md#4-health-checks) |
| **Telemetria** | 📐 | Ani jednego pakietu OpenTelemetry w repozytorium — wybór biblioteki jest wciąż decyzją do podjęcia; [`observability.md`](observability.md) |
| **Backup i odtwarzanie** | 📐 | Ani Postgresa (dane + schemat `keycloak`), ani MinIO (multimediów **nie ma w bazie**) — [§8.2](#82-backup-i-odtwarzanie) |

### Dlaczego `docker-compose.multi.yml` nie jest odpowiedzią

[`docker-compose.multi.yml`](../../backend/docker-compose.multi.yml) uruchamia pięć instancji za
load balancerem i wygląda jak wdrożenie. Nim nie jest i jego własny nagłówek mówi to wprost:
instancje chodzą z **bind-mountem repozytorium na obrazie SDK** i `dotnet run`, bo backend nie ma
dziś Dockerfile'i. To narzędzie do udowodnienia, że fazy 1–5 wieloinstancyjności działają.

Wartość dla tego planu jest jednak realna — plik pokazuje **działający kształt topologii
produkcyjnej**: które zmienne środowiskowe faktycznie sterują serwisem, że Relay musi być jeden,
że nginx potrzebuje `Upgrade`/`Connection` i długiego `proxy_read_timeout` dla `/hubs/sync`,
i że Keycloak wymaga `KC_HOSTNAME`, żeby emitent tokenu był jeden dla wszystkich. Po fazie A ten
plik ma się skurczyć do `image:` + `deploy.replicas` i przestać być profilem testowym.

---

## 2. Zasada przewodnia

**Jeden artefakt przechodzi przez wszystkie środowiska.** Obraz zbudowany raz jest tym samym
obrazem na dev, stage i produkcji; różni je wyłącznie konfiguracja podana z zewnątrz. Wszystko
w tym planie wynika z tej jednej reguły:

- adresy, hasła i klucze **nie mogą** być wkompilowane — stąd faza B i to, że dotyczy ona
  frontu tak samo jak backendu (dziś front ma je w kodzie źródłowym);
- migracja schematu jest **krokiem wdrożenia**, nie efektem ubocznym startu procesu — inaczej
  „ten sam obraz" zachowuje się różnie w zależności od tego, kto wstał pierwszy;
- środowisko musi dać się odtworzyć z repozytorium i backupu — inaczej nie ma czego promować.

Druga zasada: **nie budujemy warstwy operacyjnej na zapas.** Kolejność faz jest ułożona tak, żeby
każda następna była niemożliwa bez poprzedniej, a nie żeby domknąć listę życzeń. Kubernetes,
service mesh i autoskalowanie nie występują w tym planie, bo pierwszy klient nie potrzebuje ich
do zalogowania się.

---

## 3. Kolejność faz

| Faza | Zakres | Bez niej nie da się | Stan |
|---|---|---|---|
| A | Obrazy kontenerów backendu i frontu | wdrożyć czegokolwiek | 📐 |
| B | Konfiguracja z zewnątrz, sekrety poza repo | mieć więcej niż jedno środowisko | 📐 |
| C | Jeden origin, reverse proxy, TLS | wystawić aplikacji publicznie | 📐 |
| D | Schemat bazy i Keycloak produkcyjny | wdrożyć drugi raz bez ręcznej roboty | 📐 |
| E | Topologia runtime: repliki, Hub/Relay, health checks | przetrwać restart instancji | 📐 |
| F | Telemetria, backup, odtwarzanie | dowiedzieć się, że coś nie działa | 📐 |
| G | CI/CD | wdrażać powtarzalnie | 📐 |

Fazy A–C są sekwencyjne. D i E dają się prowadzić równolegle po C. F warto zacząć razem z E
(health checks są potrzebne obu). G domyka całość i ma sens dopiero, gdy jest co budować.

---

## 4. Faza A — pakowanie

### 4.1 Backend — `Dockerfile` per `*.Api`

Cztery projekty `Api` (Catalog, Identity, Notification, Sales) dostają obraz z jednego wspólnego
szablonu. Wymagania, które nie są kwestią gustu:

- **Multi-stage** — `mcr.microsoft.com/dotnet/sdk:10.0` do budowy, `aspnet:10.0` do uruchomienia.
  Obraz SDK waży kilkukrotnie więcej i zawiera kompilator, którego produkcja nie potrzebuje.
- **Kopiowanie plików projektu przed resztą źródeł** — `Directory.Build.props`,
  `Directory.Packages.props` i wszystkie `*.csproj`, potem `dotnet restore`, dopiero potem reszta
  kodu. Bez tego każda zmiana w dowolnym pliku `.cs` unieważnia warstwę z pakietami.
  Centralne zarządzanie pakietami (CPM) sprawia, że `Directory.Packages.props` **musi** trafić
  do obrazu wcześniej niż projekty — inaczej `restore` nie zna wersji.
- **Kontekst budowania = `backend/`**, nie katalog projektu — projekty referują
  `building-blocks/` spoza swojego drzewa. Potrzebny `backend/.dockerignore` wycinający `bin/`,
  `obj/` i `**/node_modules` (bez tego kontekst puchnie o wynik lokalnych buildów i potrafi
  wnieść do obrazu artefakty z innego `ErpBuildSlot`).
- **Użytkownik nie-root** i `ASPNETCORE_URLS=http://+:8080` — port 8080 jest już konwencją
  wewnętrzną w profilu multi, warto ją utrzymać, żeby proxy nie musiało znać czterech portów.

### 4.2 Frontend — obraz ze statykami

`nx build` produkuje statyki; obraz to nginx z tymi plikami i konfiguracją SPA-fallback
(`try_files $uri $uri/ /index.html`) oraz nagłówkami cache: **`index.html` bez cache, reszta
z długim `max-age`** (pliki mają hash w nazwie). Bez tego rozdziału użytkownik po wdrożeniu
dostaje stary `index.html` wskazujący na bundle, których już nie ma.

Wybór między buildem monolitycznym a mikrofrontendowym jest decyzją otwartą — [§10.2](#102-front-mfe-czy-monolit).

**Skończone, gdy:** `docker build` dla każdego serwisu i frontu przechodzi, a
`docker-compose.multi.yml` używa `image:` zamiast bind-mountu i `dotnet run` — i nadal spełnia
kryteria akceptacji z [`multi-instance.md` §10](../architecture/multi-instance.md#10-kryteria-akceptacji).

---

## 5. Faza B — konfiguracja i sekrety

### 5.1 Backend

Mechanizm już istnieje i jest sprawdzony: ASP.NET czyta zmienne środowiskowe w konwencji
`Sekcja__Klucz`, a profil multi karmi tak wszystkie serwisy
(`ConnectionStrings__CatalogDb`, `Messaging__RabbitMqConnectionString`, `Keycloak__Authority`…).
Do zrobienia zostaje:

- `appsettings.Production.json` z wartościami **nie**wrażliwymi (poziomy logowania, rozmiary
  chunków, retencje) i bez jednego hasła;
- lista zmiennych obowiązkowych per serwis, spisana w jednym miejscu — dziś rozproszona po
  `appsettings.Development.json` czterech modułów;
- **sekrety poza repozytorium**: hasła Postgresa i RabbitMQ, klucze MinIO per serwis
  (`Artifacts:AccessKey`/`SecretKey` — dziś `catalog`/`catalog12345`), dane admina Keycloaka.
  Mechanizm zależy od celu wdrożenia (Docker secrets / zmienne w panelu / zewnętrzny vault),
  ale reguła jest niezależna: **w repozytorium zostają wyłącznie hasła deweloperskie i to jest
  jedyne, do czego one pasują.**

Zdrowa właściwość, którą warto zachować: `AddErpAuth` rzuca wyjątkiem przy braku
`Keycloak:Authority`. Brak konfiguracji ma **kłaść start**, nie uruchamiać cichy fallback.
Ta sama zasada powinna objąć nowe klucze produkcyjne.

### 5.2 Frontend — konfiguracja w runtime, nie w buildzie

To jest największa pojedyncza przeszkoda przed „jeden artefakt, wiele środowisk". Dziś:

- [`remote-api.providers.ts`](../../frontend/apps/client/src/app/remote-api.providers.ts) wstrzykuje literały
  `http://localhost:5149`, `:5250`, `:5280` i `http://localhost:5250/hubs/sync`;
- [`module-federation.manifest.json`](../../frontend/apps/client/public/module-federation.manifest.json)
  wskazuje remote'y na `localhost:4201-4207`.

Oba są **build-time**, więc każde środowisko wymaga własnej kompilacji — a to znaczy, że
przetestowany artefakt nigdy nie jest tym, który idzie na produkcję.

Docelowo: plik `assets/config.json` obok statyk, wczytywany przed startem aplikacji
(`provideAppInitializer`), z którego karmione są tokeny DI `API_BASE_URL` i `SIGNALR_HUB_URL`
oraz manifest federacji. Plik jest jedyną rzeczą różniącą środowiska i podmienia go entrypoint
obrazu albo wolumen — obraz zostaje ten sam. Po fazie C wartości i tak stają się **względne**
(`/api/catalog`, `/hubs/sync`), co redukuje ten plik prawie do zera, ale mechanizm musi istnieć
wcześniej, bo stage i produkcja nadal będą się różnić choćby adresem Keycloaka.

**Skończone, gdy:** ten sam obraz frontu wstaje pod dwoma różnymi adresami API bez przebudowy.

---

## 6. Faza C — jeden origin i TLS

Dziś przeglądarka rozmawia z czterema różnymi originami (front + trzy API), stąd CORS z
`AllowCredentials` i domyślna lista `DefaultDevOrigins()` — jedenaście portów `localhost`
wpisanych w kod `ErpApiExtensions`. Na produkcji to jest zarówno kłopot konfiguracyjny, jak
i niepotrzebna powierzchnia.

Reverse proxy z terminacją TLS przed wszystkim (Traefik albo Caddy — automatyczny Let's Encrypt;
nginx, jeśli certyfikaty i tak są zarządzane osobno), routing po ścieżce:

| Ścieżka | Cel | Uwagi |
|---|---|---|
| `/` | obraz frontu | SPA-fallback |
| `/api/catalog/*` | Catalog ×N | round-robin, bez powinowactwa |
| `/api/identity/*` | Identity ×N | |
| `/api/notification/*` | huby Notification ×N | |
| `/hubs/sync` | huby Notification ×N | **`Upgrade`/`Connection`**, `proxy_read_timeout` rzędu godziny |
| `/auth/*` | Keycloak | |

Wzorzec dla WebSocketu jest już napisany i sprawdzony w
[`nginx/multi.conf`](../../backend/nginx/multi.conf) — razem z uzasadnieniem, dlaczego
powinowactwo sesji nie jest potrzebne (front łączy się z `skipNegotiation: true`, więc SignalR
nie zostawia stanu do przyklejenia) i z ostrzeżeniem o tym, że nginx rozwiązuje nazwy upstreamów
raz przy starcie. Ta druga pułapka na produkcji jest groźniejsza niż w teście: po odtworzeniu
kontenera ruch trafia pod adres, który w międzyczasie należy do czegoś innego. Traefik z
odpytywaniem Dockera nie ma tego problemu — to argument za nim, mocniejszy niż automatyczny TLS.

Skutki uboczne, które warto policzyć jako zysk: znika CORS (wszystko z jednego originu),
`SIGNALR_HUB_URL` wraca do względnego `/hubs/sync` — czyli do wartości, którą kod
[`remote-api.providers.ts`](../../frontend/apps/client/src/app/remote-api.providers.ts) sam wskazuje jako docelową.

**Skończone, gdy:** aplikacja działa pod jedną nazwą domenową po HTTPS, a serwisy nie mają
wystawionych portów na zewnątrz proxy.

---

## 7. Faza D — schemat bazy i Keycloak produkcyjny

### 7.1 Migracje

Domyślna wartość jest już właściwa: `Database:MigrateOnStartup` to `false`, a `true` ustawia
wyłącznie `appsettings.Development.json` — komentarz w `ErpDatabaseMigrator` wprost mówi, że
„na produkcji flaga jest wyłączona i migruje wdrożenie". Do zrobienia zostaje **krok wdrożenia**:
osobne uruchomienie (`dotnet ef database update` albo bundle migracyjny w obrazie), które chodzi
**przed** startem nowych instancji i jest bramką — nieudana migracja zatrzymuje wdrożenie.

Konsekwencja, o której łatwo zapomnieć: każdy moduł ma **własny łańcuch migracji** w swoim
schemacie, więc kroków jest tyle, ile modułów, i muszą być niezależne od siebie. Seed
(`Seed:Enabled`) na produkcji zostaje wyłączony — 1500 przykładowych produktów to dane
deweloperskie.

### 7.2 Keycloak

- `start` zamiast `start-dev`, `KC_HOSTNAME` na publiczny adres (bez tego emitent `iss` zmienia
  się zależnie od hosta żądania i serwisy odrzucają tokeny — dokładnie ten problem opisuje
  komentarz przy `KeycloakOptions.MetadataAddress`);
- własne hasło administratora zamiast `admin/admin`, konsola administracyjna niewystawiona
  publicznie;
- baza Keycloaka: dziś schemat `keycloak` w tej samej instancji Postgresa co dane biznesowe.
  Do świadomego rozstrzygnięcia — wspólna instancja upraszcza backup, ale wiąże cykl życia IdP
  z cyklem życia bazy aplikacyjnej;
- realm: `realm-erp.json` jest **bootstrapem**, nie źródłem prawdy. Po pierwszym imporcie realm
  żyje w bazie; `--import-realm` przy każdym starcie na produkcji jest prośbą o nadpisanie
  zmian zrobionych w konsoli. Eksport realmu wchodzi natomiast do zakresu backupu.

---

## 8. Faza E i F — runtime, obserwowalność, backup

### 8.1 Topologia i health checks

Kształt wynika wprost z [`multi-instance.md`](../architecture/multi-instance.md) i nie ma tu swobody:

- Catalog, Identity, Sales — dowolna liczba replik;
- Notification — **huby ×N i dokładnie jeden Relay**; tylko Relay konsumuje `notification.events`
  (huby z pustym `Messaging__ListenQueueName`), bo koalescencja i licznik sekwencji wymagają
  jednego miejsca decyzyjnego;
- Redis — wyłącznie backplane SignalR. Nie dokładać do niego cache'u uprawnień ani kolejek:
  awaria Redisa ma degradować realtime, a nie kłaść autoryzację całego ERP;
- `Messaging:PrecompiledHandlers=true` + krok `dotnet run -- codegen write` w pipelinie —
  [`architecture.md` §7](../architecture/backend.md#7-wieloinstancyjność--założenia-zdjęte) nazywa
  włączenie tej flagi „decyzją wdrożenia"; przy równoległym starcie kilku instancji znika przy
  okazji wyścig na generowanym kodzie.

Do dopisania: `/health/live` (proces żyje) i `/health/ready` (Postgres, RabbitMQ, MinIO
odpowiadają) — rejestrowane w `AddErpApi`/`UseErpApi`, żeby żaden `Program.cs` nie mógł ich
pominąć, tak samo jak dziś nie może pominąć CORS-u i uwierzytelniania. Bez `ready` proxy kieruje
ruch do instancji, która jeszcze nie zestawiła połączeń, a wdrożenie kroczące zamienia się
w krótką awarię.

### 8.2 Backup i odtwarzanie

Dwa niezależne przedmioty backupu, bo dane leżą w dwóch miejscach:

- **Postgres** — dane wszystkich modułów, `job`/`job_item`, klucze idempotencji **i** schemat
  `keycloak`. Kopia okresowa plus archiwizacja WAL (PITR).
- **MinIO** — multimediów wgranych przez użytkowników **nie ma w bazie**; baza trzyma tylko
  referencje. Utrata kubełka `media` to utrata plików bez możliwości odtworzenia z Postgresa.
  Wersjonowanie obiektów i replikacja na drugą lokalizację. Kubełek `transient` (eksporty,
  retencja 7 dni) backupu nie potrzebuje — jest odtwarzalny przez ponowne uruchomienie eksportu.

Kluczowa rzecz, którą trzeba przećwiczyć, a nie zapisać: **próbne odtworzenie**. Backup
niesprawdzony odtworzeniem jest założeniem, nie zabezpieczeniem — i rozjazd baza↔magazyn
(referencja bez pliku) jest tu realnym scenariuszem, o którym mówi
[`media-storage.md` §4d](../guides/backend/media-storage.md).

### 8.3 Telemetria

Pełny rozpis — stos narzędzi, sygnały, progi i kolejność wdrażania — jest w osobnym dokumencie:
[`observability.md`](observability.md). Tutaj tylko zakres minimalny, bez którego nie ma sensu
wychodzić na produkcję.

W repozytorium **nie ma dziś żadnego pakietu OpenTelemetry** — decyzja co do biblioteki nie została
podjęta, jest do podjęcia. Minimalny zakres, który realnie odpowiada na pytania eksploatacyjne
tego systemu:

- ślady HTTP + EF + Wolverine (żądanie → komenda → outbox → konsument to najczęstsza ścieżka
  diagnozy);
- logi strukturalne z korelacją po `X-Request-Id` — nagłówek już płynie z frontu i służy
  idempotencji, więc jest gotowym identyfikatorem korelacji;
- alerty na trzy rzeczy specyficzne dla tej architektury: **rosnący outbox** (zdarzenia nie
  wychodzą), **`job` w stanie failed** — a jeszcze bardziej `job` wiszący w `Running`, bo tego
  użytkownik nie zgłosi — oraz **brak żywego Relaya** (realtime zamiera cicho: huby działają,
  klienci są połączeni, tylko nikt nie rozsyła zmian).

**Uwaga do §8.1:** `/health/ready` nie może sprawdzać RabbitMQ ani MinIO. Bogaty `ready` przy
padzie brokera wyrzuca z rotacji wszystkie instancje naraz i kładzie API, choć outbox jest właśnie
po to, żeby ten pad przetrwać — [`observability.md` §4](observability.md#4-health-checks).


---

## 9. Faza G — CI/CD

1. Build + testy: `Erp.ArchitectureTests` oraz `Erp.IntegrationTests` — te ostatnie chodzą na
   Testcontainers, więc CI nie potrzebuje infrastruktury poza Dockerem
   ([`multi-instance.md` §10](../architecture/multi-instance.md#10-kryteria-akceptacji)).
2. Build frontu (`nx affected` wystarcza — monorepo już to umie) plus lint granic modułów.
3. Obrazy tagowane SHA commita. **Nigdy `latest`** na produkcji: bez wersji w tagu nie da się
   odpowiedzieć na pytanie, co właściwie jest wdrożone, ani wrócić do poprzedniego stanu.
4. Wdrożenie: krok migracji jako bramka → podmiana tagów → sprawdzenie `ready`.
5. Regeneracja handlerów Wolverine (`codegen write`) jako krok budowy, nie czynność ręczna —
   inaczej `PrecompiledHandlers=true` wcześniej czy później rozjedzie się z kodem.

---

## 10. Decyzje otwarte

### 10.1 Gdzie to postawić

Rekomendacja: **jeden serwer + `docker-compose.prod.yml` + Traefik.** Cała wieloinstancyjność
jest już gotowa, więc skalowanie sprowadza się do `deploy.replicas`, a Kubernetes na tym etapie
dokłada koszt operacyjny bez zysku. Późniejsze przejście na klaster nie wymaga zmian w kodzie —
te same obrazy, inne manifesty wokół nich. Warunek: to musi być decyzja, a nie zaniechanie —
przy jednym serwerze backup i odtworzenie z [§8.2](#82-backup-i-odtwarzanie) są **jedyną**
ochroną przed jego utratą.

### 10.2 Front: MFE czy monolit

Build monolityczny (`client:esbuild:production` ze wkompilowanymi modułami) to jeden artefakt
i jeden deploy. Native Federation na produkcji wymaga hostowania każdego remote'a pod stabilnym
adresem, wersjonowania manifestu i pilnowania zgodności bibliotek dzielonych między hostem
a remote'ami — ma sens dopiero, gdy moduły mają się wdrażać niezależnie od siebie i od hosta.
Rekomendacja na pierwsze wyjście produkcyjne: **monolit**, z zachowaniem obu ścieżek buildu,
które `project.json` już definiuje.

### 10.3 Do rozstrzygnięcia przy okazji

- MinIO w wariancie jednowęzłowym nie daje odporności na utratę dysku — replikacja czy
  zewnętrzny magazyn zgodny z S3?
- RabbitMQ pojedynczy węzeł: przy padzie brokera outbox trzyma zdarzenia w bazie (dane są
  bezpieczne), ale integracja stoi. Kolejkowanie jest trwałe — pytanie brzmi, jak długo taki
  postój jest akceptowalny.
- Retencja: `job`/`job_item` i `grant_audit` rosną monotonicznie. `IdempotencyCleanupService`
  ma już swój odpowiednik dla kluczy; dla historii zadań i audytu polityki jeszcze nie ma.

---

## 11. Checklist przed pierwszym wyjściem

- [ ] Każdy serwis i front mają obraz; `docker-compose.multi.yml` używa `image:`
- [ ] Żadnego hasła produkcyjnego w repozytorium
- [ ] Front wstaje pod nowym adresem API bez przebudowy
- [ ] Wszystko za jedną domeną po HTTPS; serwisy bez portów wystawionych na zewnątrz proxy
- [ ] `Seed:Enabled=false`, `Database:MigrateOnStartup` nieustawione, migracja jako krok wdrożenia
- [ ] Keycloak: `start`, `KC_HOSTNAME`, własne hasło admina, konsola nieodsłonięta
- [ ] Notification: huby ×N + **dokładnie jeden** Relay; Redis podłączony
- [ ] `/health/ready` odpowiada i proxy z niego korzysta
- [ ] Backup Postgresa i MinIO działa, **odtworzenie przećwiczone**
- [ ] Alerty: outbox, `job` failed, brak Relaya, dysk — [`observability.md` §9](observability.md#9-checklist)
- [ ] Czujka uptime **poza tym serwerem**, z powiadomieniem na telefon
- [ ] Wdrożenie wykonane dwa razy z rzędu z pipeline'u, bez kroków ręcznych

---

## 12. Zobacz też

- [Architektura backendu](../architecture/backend.md) — [§1 stan wdrożenia](../architecture/backend.md#1-stan-wdrożenia), [§7 wieloinstancyjność](../architecture/backend.md#7-wieloinstancyjność--założenia-zdjęte)
- [Wieloinstancyjność — plan wdrożenia](../architecture/multi-instance.md) — topologia, role, dowody
- [Tożsamość i uprawnienia](../architecture/security.md) — Keycloak i moduł Identity
- [Magazyn plików](../guides/backend/media-storage.md) — kubełki, retencja, rozjazd baza↔magazyn
- [Obserwowalność i niezawodność](observability.md) — health checks, alerty, zapobieganie awariom
- [Persystencja — EF Core i Postgres](../guides/backend/persistence-ef.md) — migracje i seed
