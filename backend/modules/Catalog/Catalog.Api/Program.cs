using Catalog.Application.Abstractions;
using Catalog.Infrastructure;
using Catalog.Infrastructure.Repositories;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Api.BackgroundJobs;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP: FastEndpoints, Swagger, CORS dla mikrofrontendów,
// IClock i kontekst wykonania. Jedno miejsce dla wszystkich mikroserwisów.
builder.Services.AddErpApi();

// Baza, zapytania, dane startowe, mapa sygnatur SignalR.
builder.Services.AddCatalogInfrastructure(builder.Configuration);

builder.Services.AddScoped<IProductRepository, ProductRepository>();

// Tymczasowa kolejka in-memory dla operacji masowych — zostaje zastąpiona przez
// BulkCommandRunner (zadania utrwalone w bazie) w kolejnym kroku. Do tego czasu
// zachowuje dotychczasowe zachowanie endpointów `batch-*`.
builder.Services.AddSingleton<IBackgroundTaskQueue>(_ => new DefaultBackgroundTaskQueue(1000));
builder.Services.AddHostedService<QueuedHostedService>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseErpApi();

await app.RunAsync();
