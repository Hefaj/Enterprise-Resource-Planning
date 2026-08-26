using Catalog.Application.Products;
using Catalog.Infrastructure.Jobs;
using Catalog.Infrastructure.Persistence;
using Catalog.Infrastructure;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Artifacts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using JasperFx;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP: FastEndpoints, Swagger, CORS dla mikrofrontendów,
// IClock i kontekst wykonania. Jedno miejsce dla wszystkich mikroserwisów.
builder.Services.AddErpApi("Catalog", builder.Configuration);

// Baza, zapytania, dane startowe, mapa sygnatur SignalR.
builder.Services.AddCatalogInfrastructure(builder.Configuration);

// Skan zestawów modułu: handlery komend, reguły i walidatory wsadowe, egzekutory zadań
// masowych, repozytoria i zapytania (konwencja I{Nazwa} → {Nazwa}). Nowa komenda albo nowa
// reguła nie wymaga już dopisania tu ani jednej linijki — patrz ErpModuleRegistrationExtensions.
builder.Services.AddErpModule(
    typeof(ProductSetNameCommand).Assembly,
    typeof(CatalogDbContext).Assembly);

// Wolverine: transport RabbitMQ + outbox spięty z transakcją EF. Rejestruje też
// IIntegrationEventPublisher i IUnitOfWork, na których stoi automatyczna publikacja
// AggregateChanged ze skanu ChangeTrackera.
builder.AddErpMessaging<CatalogDbContext>(typeof(CatalogDbContext).Assembly);

// Silnik zadań masowych: trwałe zadania w schemacie `catalog`, wznawiane po restarcie.
// Pipeline komend: logowanie → walidacja wejścia → jednostka pracy → idempotencja.
// Parametr typowy wskazuje, w czyim schemacie leżą klucze idempotencji — muszą być
// w tej samej bazie co dane, żeby klucz i skutek komendy były jednym commitem.
builder.Services.AddErpCommands<CatalogDbContext>(builder.Configuration);

builder.Services.AddErpBulkJobs<CatalogDbContext>(builder.Configuration);

// Magazyn artefaktów (MinIO) + założenie kubełka przy starcie, oraz runner przebiegów eksportu.
// Rejestracje jawne, bo niosą decyzję: singleton z pulą połączeń i dwie usługi hostowane —
// konwencja I{Nazwa} → {Nazwa} nie zna żadnego z tych cykli życia.
builder.Services.AddErpArtifacts(builder.Configuration);
builder.Services.AddHostedService<ExportRunner>();

// Audytor rozjazdu magazyn ↔ katalog. Domyślnie WYŁĄCZONY i w trybie raportowania — to
// narzędzie diagnostyczne, a nie element normalnej pracy modułu (docs/backend/media-storage.md §4d).
builder.Services.Configure<MediaReconciliationOptions>(
    builder.Configuration.GetSection(MediaReconciliationOptions.SectionName));
builder.Services.AddHostedService<MediaReconciliationService>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Dokumentacja API jawnie publiczna — inaczej Swagger UI/NSwag potrzebowałyby tokenu,
    // żeby zobaczyć, jak w ogóle zdobyć token. Fallback policy z ErpAuthExtensions objęłaby
    // też ten endpoint bez tego jawnego wyjątku.
    app.MapOpenApi().AllowAnonymous();
}

app.UseErpApi("Catalog");

// ── URUCHOMIENIE ─────────────────────────────────────────────────────────────────────────────
//
// `RunJasperFxCommands`, a nie `RunAsync`: bez argumentów zachowuje się identycznie (podnosi
// serwis), ale wystawia narzędzia wiersza poleceń Wolverine'a — przede wszystkim
// `dotnet run -- codegen write`, którym generuje się kod handlerów z wyprzedzeniem dla trybu
// `Messaging:PrecompiledHandlers`. Bez tego przełącznika nie da się użyć, bo nie ma czym
// wytworzyć kodu, którego oczekuje.
return await app.RunJasperFxCommands(args);
