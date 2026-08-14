# Architektura backendu

Backend to **mikroserwisy .NET 10**, po jednym na moduł biznesowy, każdy w **Clean Architecture**
z rozdziałem CQRS. Dane w **PostgreSQL** przez EF Core, komunikacja między serwisami zdarzeniami
przez **RabbitMQ** (Wolverine, transactional outbox). Frontend woła API swojego mikroserwisu
bezpośrednio — **nie ma warstwy BFF ani agregacji**.

Skrócona wersja jest wciągnięta do [`CLAUDE.md`](../../CLAUDE.md).

---

## 1. Stan wdrożenia

Dokumentacja opisuje docelową architekturę, ale nie wszystko jest już podpięte. Legenda używana
konsekwentnie we wszystkich dokumentach w tym katalogu:

| Znacznik | Znaczenie |
|---|---|
| ✅ | Działa i jest zweryfikowane end-to-end |
| 🟡 | Kod istnieje i się kompiluje, ale **nie jest podpięty** w żadnym `Program.cs` |
| 📐 | Projekt/decyzja, brak kodu |

| Obszar | Stan | Uwagi |
|---|---|---|
| Struktura projektów, granice warstw | ✅ | Wymuszone testem `Erp.ArchitectureTests` (5/5) |
| Persystencja EF + Postgres, migracje, seed | ✅ | [`persistence-ef.md`](./persistence-ef.md) |
| Strona odczytu (CQRS queries) | ✅ | Catalog: produkty, kategorie, drzewo, modele, gwarancje, multimedia |
| Strona zapisu (komendy, `IUnitOfWork`) | 🟡 | `IUnitOfWork` rejestruje dopiero `AddErpMessaging` — patrz niżej |
| Domain events → outbox → RabbitMQ | 🟡 | [`events-outbox.md`](./events-outbox.md) |
| Operacje masowe (`job`/`job_item`, runner) | 🟡 | Endpointy `batch-*` nadal na starej, **niedziałającej** kolejce — [`bulk-commands.md`](./bulk-commands.md) |
| SignalR (hub, grupy, reconnect) | 📐 | [`realtime-signalr.md`](./realtime-signalr.md) |

> **Uwaga praktyczna.** `IUnitOfWork` jest rejestrowany **wyłącznie** w
> `ErpMessagingExtensions.AddErpMessaging<TContext>()`. Żaden moduł jeszcze go nie woła, więc
> handlery komend (`ProductSetNameCommandHandler` i spółka) **nie dadzą się rozwiązać z kontenera**.
> Podpięcie messagingu jest warunkiem uruchomienia całej strony zapisu — nie da się zrobić jednego
> bez drugiego i jest to celowe: zapis bez outboxu oznaczałby zmiany w bazie, o których nikt się nie dowie.

---

## 2. Struktura katalogów

```
backend/
├── Directory.Build.props           # net10.0, nullable, warnings-as-errors, CPM
├── Directory.Packages.props        # wersje WSZYSTKICH pakietów — jedyne miejsce
├── .editorconfig                   # migracje EF oznaczone jako kod generowany
├── podman-compose.yml              # postgres:17, rabbitmq:4-management
│
├── building-blocks/                # część wspólna dla wszystkich mikroserwisów
│   ├── Erp.BuildingBlocks.Domain/         # Entity, AggregateRoot, ValueObject, DomainException
│   ├── Erp.BuildingBlocks.Contracts/      # kontrakty integracyjne (publiczne, wersjonowane)
│   ├── Erp.BuildingBlocks.Application/    # abstrakcje: IClock, IUnitOfWork, IExecutionContext…
│   ├── Erp.BuildingBlocks.Persistence/    # ErpDbContext, AggregateChangeScanner, ErpUnitOfWork
│   ├── Erp.BuildingBlocks.Messaging/      # Wolverine: RabbitMQ + outbox na Postgresie
│   ├── Erp.BuildingBlocks.Jobs/           # Job, JobItem, BulkCommandRunner
│   └── Erp.BuildingBlocks.Api/            # bootstrap FastEndpoints/CORS + kontrakty żądań
│
├── modules/
│   ├── Catalog/                    # wzorcowy moduł — na nim modeluj kolejne
│   │   ├── Catalog.Domain/         # agregaty, reguły, zdarzenia domenowe
│   │   ├── Catalog.Application/    # komendy, zapytania, DTO, abstrakcje repozytoriów
│   │   ├── Catalog.Infrastructure/ # DbContext, konfiguracje EF, migracje, repozytoria, seed
│   │   └── Catalog.Api/            # endpointy FastEndpoints, Program.cs
│   ├── Notification/               # jeszcze na mockach
│   └── Sales/                      # szkielet
│
└── tests/
    └── Erp.ArchitectureTests/      # granice warstw — odpowiednik ESLinta z frontendu
```

Nazewnictwo `backend/modules/<Moduł>/` mapuje się 1:1 na `frontend/libs/modules/<moduł>/`
i na mapę portów z `CLAUDE.md`.

---

## 3. Cztery warstwy modułu

```
Api ──────► Application ──────► Domain
 │               ▲
 └──► Infrastructure ──┘        (implementuje interfejsy z Application)
```

| Warstwa | Rola | Może referencować |
|---|---|---|
| `Domain` | Agregaty, reguły biznesowe, zdarzenia domenowe. **Zero** EF, ASP.NET, Wolverine'a. | `BuildingBlocks.Domain` |
| `Application` | Komendy, handlery, zapytania (interfejsy), DTO, abstrakcje repozytoriów. | `Domain`, `BuildingBlocks.{Application,Api}` |
| `Infrastructure` | `DbContext`, konfiguracje EF, migracje, repozytoria, implementacje zapytań, consumery, seed. | `Domain`, `Application`, `BuildingBlocks.{Persistence,Messaging,Jobs}` |
| `Api` | Endpointy FastEndpoints, `Program.cs` (kompozycja kontenera DI). | `Application`, `Infrastructure`, `BuildingBlocks.Api` |

`Api` referencuje `Infrastructure` **wyłącznie po to, żeby złożyć kontener** w `Program.cs`.
Kod endpointów sięga do abstrakcji z `Application` — nigdy do EF bezpośrednio.

### Dlaczego to jest wymuszone testem, a nie konwencją

`Erp.ArchitectureTests` (NetArchTest) sprawdza m.in., że `Domain` i `Application` nie zależą od
EF Core, ASP.NET, Wolverine'a i Npgsql. To świadomy odpowiednik `@nx/enforce-module-boundaries`
z frontendu: złamanie granicy ma wywalić build, a nie zostać wyłapane (albo i nie) w code review.
Reguła zapisana wyłącznie w dokumencie jest regułą, która prędzej czy później przestaje obowiązywać.

```bash
dotnet test backend/tests/Erp.ArchitectureTests/Erp.ArchitectureTests.csproj
```

---

## 4. Decyzje technologiczne i ich powody

| Decyzja | Powód |
|---|---|
| **Wolverine** (nie MassTransit) | MassTransit v9 jest komercyjny (min. $400/mies.), a v8 (Apache 2.0) wchodzi w EOL z końcem 2026. Wolverine jest na licencji MIT i wnosi durable outbox zintegrowany z transakcją EF Core. |
| **FastEndpoints Command Bus** (nie MediatR) | MediatR od v13 jest płatny. FastEndpoints był już w projekcie, ma pipeline'y i nie wymaga nowej zależności. |
| **Klasyczne CQRS**, bez event sourcingu | Stan bieżący + zdarzenia domenowe wystarczają dla ERP. Event sourcing dokłada wersjonowanie zdarzeń i utrudnia zapytania ad-hoc bez korzyści, której tu potrzeba. |
| **Jedna baza, schemat per moduł** | Prostsze lokalnie niż baza per serwis; rozdzielenie to potem zmiana connection stringów. Granicy pilnuje osobny `DbContext` per moduł. |
| **UUID v7 jako klucz główny** | Sekwencyjny po czasie, więc wstawki nie fragmentują indeksu B-tree jak losowy v4. Identyfikator jest częścią kontraktu z frontendem (orkiestratory adresują agregaty po `uuid`). |
| **`xmin` jako token współbieżności** | Systemowa kolumna Postgresa — kontrola współbieżności bez dodatkowej kolumny w każdej tabeli. |

---

## 5. Uruchomienie lokalne

```bash
podman compose -f backend/podman-compose.yml up -d
```

Postgres na `5432` (`erp`/`erp`/`erp`), RabbitMQ na `5672`, management UI na
[localhost:15672](http://localhost:15672).

```bash
dotnet run --project backend/modules/Catalog/Catalog.Api
```

Przy starcie w `Development` moduł stosuje migracje i zasila bazę danymi przykładowymi
(sterowane przez `Database:MigrateOnStartup` i sekcję `Seed` — patrz
[`persistence-ef.md`](./persistence-ef.md)).

| Serwis | Port HTTP | Schemat w bazie |
|---|---|---|
| Catalog | 5149 | `catalog` |
| Notification | 5250 | `notification` |
| Sales | — | `sales` |

Adresy bazowe dla frontendu konfiguruje
[`remote-api.providers.ts`](../../frontend/apps/client/src/app/remote-api.providers.ts).

---

## 6. Kontrakt z frontendem

Kontrakt HTTP jest **zamrożony**: klienty TypeScript są generowane NSwagiem
(`frontend/libs/modules/*/data-access/nswag.json`), a orkiestratory budują na nich ViewModele.
Zmiana nazwy typu, pola albo ścieżki to zmiana łamiąca.

Dwie rzeczy, które łatwo złamać nieumyślnie:

1. **Nazwa klasy komendy trafia do nazwy typu w kliencie.** `ProductSetPriceCommand` generuje
   `BatchCommandOfProductSetPriceCommandAndSearchProductRequest`, importowane wprost przez
   `catalog-product.orchestrator.ts`. Przemianowanie klasy w C# psuje frontend, mimo że sam
   JSON się nie zmienia.
2. **Nazwa klasy endpointu trafia do nazwy metody klienta.** `UseErpApi` obcina sufiks `Endpoint`,
   więc `SearchProductEndpoint` → `searchProduct`.

Weryfikacja zgodności bez regenerowania klienta:

```bash
curl -s http://localhost:5149/openapi/v1.json > /tmp/openapi.json
```

…a następnie porównanie zestawu typów i pól z `api-client.ts`. Przy migracji Catalogu na Postgresa
to porównanie (29 typów, 14 ścieżek) wychwyciło rozjazd, którego testy jednostkowe by nie złapały.

---

## 7. Zobacz też

- [Persystencja — EF Core i Postgres](./persistence-ef.md)
- [CQRS — komendy i zapytania](./cqrs.md)
- [Zdarzenia domenowe, outbox i integracja](./events-outbox.md)
- [Operacje masowe](./bulk-commands.md)
- [Synchronizacja w czasie rzeczywistym (SignalR)](./realtime-signalr.md)
- [Nowy mikroserwis — przepis](./new-microservice.md)
- Frontend: [architektura](../frontend/architecture.md), [orkiestratory](../frontend/orchestrators.md)
