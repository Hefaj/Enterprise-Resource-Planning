using Catalog.Application.Abstractions;
using Catalog.Application.Products;
using Catalog.Infrastructure;
using Catalog.Infrastructure.Persistence;
using Catalog.Infrastructure.Repositories;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using FastEndpoints;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP: FastEndpoints, Swagger, CORS dla mikrofrontendów,
// IClock i kontekst wykonania. Jedno miejsce dla wszystkich mikroserwisów.
builder.Services.AddErpApi("Catalog");

// Baza, zapytania, dane startowe, mapa sygnatur SignalR.
builder.Services.AddCatalogInfrastructure(builder.Configuration);

builder.Services.AddScoped<IProductRepository, ProductRepository>();

// Reguły wsadowe i ich kompozycja. Endpointy operacji masowych wołają wyłącznie walidator —
// to on wie, jakie reguły obowiązują dla której operacji (BatchEndpointBase.ValidateTargetsAsync).
builder.Services.AddScoped<ProductMustExistRule>();
builder.Services.AddScoped<ProductDuplicateRule>();
builder.Services.AddScoped<ProductBatchValidator>();

// Wolverine: transport RabbitMQ + outbox spięty z transakcją EF. Rejestruje też
// IIntegrationEventPublisher i IUnitOfWork, na których stoi automatyczna publikacja
// AggregateChanged ze skanu ChangeTrackera.
builder.AddErpMessaging<CatalogDbContext>(typeof(CatalogDbContext).Assembly);

// Silnik zadań masowych: trwałe zadania w schemacie `catalog`, wznawiane po restarcie.
builder.Services.AddScoped<IJobStore, JobStore<CatalogDbContext>>();
builder.Services.AddErpBulkJobs<CatalogDbContext>(builder.Configuration);

// Handlery komend jawnie w DI. FastEndpoints trzyma je we własnym rejestrze i tworzy
// z root providera, co poza żądaniem HTTP uniemożliwia wstrzyknięcie czegokolwiek scoped
// (DbContext, repozytoria). Rejestracja tutaj sprawia, że handler powstaje w scope'ie runnera.
builder.Services.AddScoped<ICommandHandler<ProductSetNameCommand, Guid>, ProductSetNameCommandHandler>();
builder.Services.AddScoped<ICommandHandler<ProductSetPriceCommand, Guid>, ProductSetPriceCommandHandler>();
builder.Services
    .AddScoped<ICommandHandler<ProductSetClassificationCommand, Guid>, ProductSetClassificationCommandHandler>();

// Egzekutory per typ komendy — runner odnajduje je po nazwie typu zapisanej w zadaniu.
// Każda nowa komenda masowa wymaga dopisania dwóch linijek: handlera wyżej i egzekutora tutaj.
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<ProductSetNameCommand>>();
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<ProductSetPriceCommand>>();
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<ProductSetClassificationCommand>>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseErpApi("Catalog");

await app.RunAsync();
