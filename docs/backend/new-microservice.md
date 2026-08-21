# Nowy mikroserwis — przepis

Dodanie kolejnego mikroserwisu (obok Catalog, Notification, Sales) wymaga czterech projektów
w Clean Architecture, wpięcia do `.sln` i kilku rejestracji w `Program.cs`, które muszą się ze
sobą zgadzać. Ten przepis jest zweryfikowany empirycznie — Sales powstał dokładnie w ten sposób
jako sprawdzian szablonu (faza 5 planu backendu): **zero nowego kodu w `building-blocks/`**.
Jeśli dodanie modułu wymaga zmiany w `building-blocks/`, to sygnał, że któryś krok tego przepisu
nie został zachowany, nie że BuildingBlocks trzeba rozszerzyć.

## Parametry wejściowe

| Parametr | Przykład (Sales) | Opis |
|---|---|---|
| `MODULE_NAME` | `Sales` | PascalCase, zgodny z `frontend/libs/modules/<moduł>/` po kebabizacji |
| `SCHEMA_NAME` | `sales` | snake_case, schemat w Postgresie |
| `PORT` | `5269` | Kolejny wolny — Catalog `5149`, Notification `5250` |
| Pierwszy agregat | `Customer` | Jeden trywialny agregat wystarczy, żeby zweryfikować szablon |

---

## Krok 1: Cztery projekty, referencje jak w Catalogu

```bash
dotnet new classlib -o backend/modules/MODULE_NAME/MODULE_NAME.Domain
dotnet new classlib -o backend/modules/MODULE_NAME/MODULE_NAME.Application
dotnet new classlib -o backend/modules/MODULE_NAME/MODULE_NAME.Infrastructure
dotnet new webapi   -o backend/modules/MODULE_NAME/MODULE_NAME.Api --no-controllers
```

Referencje między projektami — **kopiuj z `Sales/*.csproj`, nie z pierwszego lepszego przykładu**,
bo kolejność i zakres referencji tu egzekwuje `Erp.ArchitectureTests`:

| Projekt | Referencje |
|---|---|
| `.Domain` | `Erp.BuildingBlocks.Domain` — **nic więcej** |
| `.Application` | `.Domain`, `Erp.BuildingBlocks.Application`, `Erp.BuildingBlocks.Api` (wyłącznie po `PagedRequest`/`SearchResponse`/`IAggregateCommand` — to część zamrożonego kontraktu, nie warstwy HTTP) |
| `.Infrastructure` | `.Domain`, `.Application`, `Erp.BuildingBlocks.{Persistence,Messaging,Jobs}` + pakiety EF/Npgsql |
| `.Api` | `.Application`, `.Infrastructure`, `Erp.BuildingBlocks.{Api,Messaging,Jobs}` + pakiety FastEndpoints |

`.Api` referencuje `.Infrastructure` **wyłącznie po to, żeby złożyć kontener DI w `Program.cs`**
— kod endpointów sięga do abstrakcji z `.Application`, nigdy do EF bezpośrednio (patrz
[`cqrs.md`](./cqrs.md), [`architecture.md`](./architecture.md#3-cztery-warstwy-modułu)).

Dodaj do solucji:

```bash
dotnet sln Enterprise-Resource-Planning.sln add \
  backend/modules/MODULE_NAME/MODULE_NAME.Domain/MODULE_NAME.Domain.csproj \
  backend/modules/MODULE_NAME/MODULE_NAME.Application/MODULE_NAME.Application.csproj \
  backend/modules/MODULE_NAME/MODULE_NAME.Infrastructure/MODULE_NAME.Infrastructure.csproj \
  backend/modules/MODULE_NAME/MODULE_NAME.Api/MODULE_NAME.Api.csproj
```

`dotnet sln add`, nie edycja ręczna — generuje poprawne GUID-y i wpisy `GlobalSection` samo.
Grupowanie w folder solucji (`Sales`, jak Catalog i Notification) jest kosmetyczne, dorzuć ręcznie
w `.sln`, jeśli zależy Ci na spójności z resztą.

---

## Krok 2: `DbContext` implementujący `IJobDbContext`

```csharp
public sealed class SalesDbContext : ErpDbContext, IJobDbContext
{
    public const string SchemaName = "sales";

    public SalesDbContext(DbContextOptions<SalesDbContext> options) : base(options) { }

    protected override string Schema => SchemaName;

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Job> Jobs => Set<Job>();          // z IJobDbContext
    public DbSet<JobItem> JobItems => Set<JobItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SalesDbContext).Assembly);
        modelBuilder.ApplyConfiguration(new JobConfiguration());
        modelBuilder.ApplyConfiguration(new JobItemConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
```

`IJobDbContext` jest wymagany **nawet jeśli moduł na start nie ma jeszcze operacji masowych** —
`BulkCommandRunner<TContext>` i `JobStore<TContext>` są generyczne po `TContext : ErpDbContext,
IJobDbContext`, więc bez tego interfejsu moduł nie może w ogóle użyć silnika zadań później bez
migracji dodającej te dwie tabele osobno.

Fabryka do migracji offline (bez uruchamiania całego hosta — patrz
[`persistence-ef.md`](./persistence-ef.md#7-migracje)):

```csharp
public sealed class SalesDbContextFactory : IDesignTimeDbContextFactory<SalesDbContext>
{
    public SalesDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("SALES_CONNECTION_STRING")
            ?? "Host=localhost;Port=5432;Database=erp;Username=erp;Password=erp";

        var options = new DbContextOptionsBuilder<SalesDbContext>()
            .UseErpPostgres(connectionString, SalesDbContext.SchemaName,
                typeof(SalesDbContext).Assembly.GetName().Name)
            .Options;

        return new SalesDbContext(options);
    }
}
```

Migracja:

```bash
dotnet ef migrations add InitialSalesSchema \
  --project backend/modules/MODULE_NAME/MODULE_NAME.Infrastructure \
  --startup-project backend/modules/MODULE_NAME/MODULE_NAME.Infrastructure \
  --output-dir Persistence/Migrations
```

---

## Krok 3: Rejestracja infrastruktury — jeden do jednego z Catalogiem

```csharp
public static class SalesInfrastructureExtensions
{
    public const string ConnectionStringName = "SalesDb";

    public static IServiceCollection AddSalesInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(/* ... */);

        services.AddDbContext<SalesDbContext>(options => options.UseErpPostgres(
            connectionString, SalesDbContext.SchemaName,
            typeof(SalesDbContext).Assembly.GetName().Name));

        // Repozytoria i zapytania rejestruje `AddErpModule` z Program.cs po konwencji
        // I{Nazwa} → {Nazwa} — tutaj zostają wyłącznie wpisy niosące decyzję.

        // Migracja PRZED seedem — hosted service'y startują w kolejności rejestracji.
        services.AddHostedService<ErpDatabaseMigrator<SalesDbContext>>();
        services.AddHostedService<SalesSeedInitializer>();

        // Jedyny sposób, w jaki agregat staje się widoczny dla frontendu przez SignalR —
        // zapis Customer generuje AggregateChanged automatycznie, bez linijki w handlerze
        // (patrz events-outbox.md#3).
        services.AddSingleton<IAggregateSignatureMap>(
            new AggregateSignatureMap().Register<Customer>(AggregateSignatures.SalesCustomer));

        return services;
    }
}
```

Dodaj sygnaturę do **jedynego miejsca prawdy**:
[`AggregateSignatures.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/AggregateSignatures.cs)
— stała `SalesCustomer = "sales.customer"` i wpis w `AggregateSignatures.All`. Literówka tutaj nie
wywali buildu po żadnej stronie — zdarzenia po prostu przestaną cicho docierać do klientów
(patrz [`realtime-signalr.md`](./realtime-signalr.md#2-grupy)).

---

## Krok 4: `Program.cs`

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddErpApi("Sales");                              // FastEndpoints, CORS, Swagger, ProblemDetails
builder.Services.AddSalesInfrastructure(builder.Configuration);   // Krok 3

// Skan zestawów modułu: handlery komend, reguły i walidatory wsadowe, egzekutory zadań
// masowych, repozytoria i zapytania. Ta jedna linijka zastępuje wpis per komenda i per reguła —
// patrz ErpModuleRegistrationExtensions.
builder.Services.AddErpModule(
    typeof(SetCustomerNameCommand).Assembly,
    typeof(SalesDbContext).Assembly);

builder.AddErpMessaging<SalesDbContext>(typeof(SalesDbContext).Assembly);  // outbox + IUnitOfWork

// Silnik zadań masowych — pomiń, jeśli moduł na start nie ma bulk commands.
// Rejestruje też IJobStore; egzekutory przyszły ze skanu wyżej.
builder.Services.AddErpBulkJobs<SalesDbContext>(builder.Configuration);

builder.Services.AddOpenApi();

var app = builder.Build();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.UseErpApi("Sales");
await app.RunAsync();
```

`appsettings.Development.json` — trzy sekcje, wszystkie wymagane:

```json
{
  "ConnectionStrings": { "SalesDb": "Host=localhost;Port=5432;Database=erp;Username=erp;Password=erp" },
  "Database": { "MigrateOnStartup": true },
  "Seed": { "Enabled": true },
  "Messaging": {
    "ServiceName": "Sales",
    "RabbitMqConnectionString": "amqp://erp:erp@localhost:5672",
    "PostgresConnectionString": "Host=localhost;Port=5432;Database=erp;Username=erp;Password=erp",
    "AutoProvision": true
  }
}
```

`Properties/launchSettings.json` — `applicationUrl` na `PORT`.

### `project.json` w `.Api` — slot buildu dla `nx watch`

Targety NX dla projektów .NET są inferowane przez plugin `@nx/dotnet`, więc `project.json` nie
jest potrzebny do zwykłego `build`/`run`. Jest potrzebny do jednej rzeczy: nadpisania targetu
`watch` własną zmienną `ErpBuildSlot`. Bez niej dwa równoległe `dotnet watch` (`nx run-many -t
watch -p Catalog.Api Notification.Api`) budują te same projekty z `building-blocks/` do tego
samego `obj\Debug\net10.0` i blokują sobie pliki. `backend/Directory.Build.props` przekłada
`ErpBuildSlot` na osobne `obj\<slot>\` i `bin\<slot>\` dla całego grafu danego watchera.

```json
{
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "name": "MODULE_NAME.Api",
  "targets": {
    "watch": {
      "executor": "nx:run-commands",
      "continuous": true,
      "cache": false,
      "options": {
        "cwd": "backend/modules/MODULE_NAME/MODULE_NAME.Api",
        "command": "dotnet watch",
        "env": { "ErpBuildSlot": "SLOT" }
      }
    }
  }
}
```

`SLOT` — krótka, unikalna nazwa modułu (`catalog`, `notification`, `sales`). Nazwa projektu
w `project.json` musi być identyczna z inferowaną przez plugin (`MODULE_NAME.Api`), inaczej NX
zobaczy dwa projekty w jednym katalogu. Pozostałe targety (`build`, `run`, `restore`) zostają
inferowane i używają domyślnych `bin`/`obj` — slot dotyczy wyłącznie watcha.

---

## Krok 5: Pierwszy agregat, komenda, endpointy

Nic tu nie jest specyficzne dla nowego mikroserwisu — to zwykły przepis z
[`cqrs.md`](./cqrs.md) (agregat w `.Domain`, komenda + handler w `.Application`, endpoint
w `.Api`) i opcjonalnie [`bulk-commands.md`](./bulk-commands.md), jeśli moduł ma mieć operację
masową od startu. Sales dostał dokładnie jeden agregat (`Customer`), jedną komendę
(`SetCustomerNameCommand`) i jej wariant masowy (`customer/batch-set-name`) — to był cały
sprawdzian, czy szablon się powtarza bez kopiowania kodu do BuildingBlocks.

---

## Krok 6: Rejestracja we frontendzie

Poza zakresem tego dokumentu — mikroserwis bez klienta NSwag i orkiestratora jest bezużyteczny
z frontu, ale to osobny przepis: [`docs/frontend/new-module.md`](../frontend/new-module.md)
(generacja bibliotek NX) i konfiguracja `remote-api.providers.ts` dla `API_BASE_URL` nowego
modułu. Sales ma dziś backend gotowy, ale **bez** odpowiadającego klienta frontendowego —
`frontend/libs/modules/sales/` ma tylko `contract`/`feature` sprzed tego planu, żadnego
`data-access` generowanego z tego API.

---

## Checklista weryfikacji

- [ ] `dotnet build Enterprise-Resource-Planning.sln` — 0 błędów
- [ ] `dotnet test backend/tests/Erp.ArchitectureTests` — bez regresji (nowe projekty respektują granice warstw)
- [ ] Migracja się wygenerowała i stosuje przy starcie (`Database:MigrateOnStartup`)
- [ ] Nowa sygnatura jest w `AggregateSignatures.All`
- [ ] `dotnet run --project backend/modules/MODULE_NAME/MODULE_NAME.Api` startuje, `/openapi/v1.json` pokazuje nowe endpointy
- [ ] Zapis agregatu generuje wiersz w outboksie (schemat `wolverine`) — atomowość jak w [`events-outbox.md`](./events-outbox.md#7-jak-zweryfikować-atomowość-ręcznie)

---

## Zobacz też

- [Architektura backendu](./architecture.md)
- [CQRS — komendy i zapytania](./cqrs.md)
- [Operacje masowe](./bulk-commands.md)
- [Persystencja](./persistence-ef.md)
- Frontend: [nowy moduł](../frontend/new-module.md)
