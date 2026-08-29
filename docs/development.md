# Środowisko lokalne

Ten dokument jest punktem startowym do codziennej pracy z ERP. **Domyślnym trybem
frontendu jest monolit**: host kompiluje moduły razem i działa pod jednym adresem.
Native Federation uruchamiaj tylko wtedy, gdy sprawdzasz integrację remote'a.

## 1. Wymagania

- Node.js oraz `pnpm` (`packageManager` repozytorium wskazuje `pnpm@10.12.1`),
- .NET SDK 10,
- Docker Engine z Docker Compose.

Po pierwszym klonowaniu repozytorium zainstaluj zależności:

```bash
pnpm install
```

## 2. Zależności infrastrukturalne

Uruchom Postgresa, RabbitMQ, MinIO i Keycloak:

```bash
docker compose -f backend/docker-compose.yml up -d
docker compose -f backend/docker-compose.yml ps
```

Keycloak jest dostępny pod `http://localhost:8080`, a RabbitMQ Management pod
`http://localhost:15672`.

## 3. Backend lokalny

Każdy mikroserwis uruchamiaj w osobnym terminalu. Do pełnego działania hosta,
w tym logowania, katalogu użytkowników, Task Management i SignalR, uruchom:

```bash
dotnet run --project backend/modules/Identity/Identity.Api/Identity.Api.csproj
dotnet run --project backend/modules/TaskManagement/TaskManagement.Api/TaskManagement.Api.csproj
dotnet run --project backend/modules/Notification/Notification.Api/Notification.Api.csproj
```

Pozostałe obecnie zaimplementowane API uruchamiaj tylko, gdy pracujesz nad ich
modułem:

```bash
dotnet run --project backend/modules/Catalog/Catalog.Api/Catalog.Api.csproj
dotnet run --project backend/modules/Sales/Sales.Api/Sales.Api.csproj
```

| Serwis                           | Port |
| -------------------------------- | ---: |
| Catalog                          | 5149 |
| Notification (w tym hub SignalR) | 5250 |
| Sales                            | 5269 |
| Identity                         | 5280 |
| Task Management                  | 5290 |

Inventory i DMS nie mają jeszcze własnych API.

## 4. Frontend — domyślnie monolit

Z roota repozytorium uruchom:

```bash
pnpm exec nx serve client
```

Host będzie dostępny pod `http://localhost:4200`. Ten tryb jest przeznaczony do
codziennej pracy: korzysta z jednego injectora Angulara, ładuje wszystkie
moduły razem i nie wymaga uruchamiania remote'ów na portach 4201–4207.

Po imporcie realm'u z `backend/keycloak/realm-erp.json` konto demonstracyjne
aplikacji to `admin@erp.local` z hasłem `admin`. To nie jest konto administracyjne
konsoli Keycloak — konsola używa osobnego konta `admin` / `admin`.

## 5. MFE — wyłącznie test integracji

Remote można uruchomić razem z hostem, na przykład dla Task Management:

```bash
pnpm exec nx run task-management:serve-mfe
```

Używaj tego trybu do weryfikacji Native Federation, `federation.config.mjs` i
kontraktu remote'a. Nie jest on domyślnym środowiskiem pracy. Jeżeli zachowanie
różni się od monolitu, najpierw sprawdź konfigurację federacji oraz różnice
między `main.ts` i `main.mfe.ts`.

## 6. Zatrzymanie

Zatrzymaj procesy `nx serve` i `dotnet run` skrótem `Ctrl+C`. Zależności Docker
pozostaw uruchomione między sesjami; gdy chcesz je zatrzymać:

```bash
docker compose -f backend/docker-compose.yml stop
```

Polecenie `down` usuwa kontenery, a z opcją `-v` również dane wolumenów — nie
używaj go do zwykłego zakończenia pracy.
