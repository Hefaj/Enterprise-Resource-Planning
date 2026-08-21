using Catalog.Application.Products;
using Catalog.Infrastructure;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;

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
builder.Services.AddErpBulkJobs<CatalogDbContext>(builder.Configuration);

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

await app.RunAsync();
