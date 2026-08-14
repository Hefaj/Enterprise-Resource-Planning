using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using FastEndpoints;
using Sales.Application.Customers;
using Sales.Infrastructure;
using Sales.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP — identyczny z Catalog.Api/Notification.Api.
builder.Services.AddErpApi("Sales");

// Baza, zapytania, seed, mapa sygnatur SignalR.
builder.Services.AddSalesInfrastructure(builder.Configuration);

// Wolverine: outbox spięty z transakcją EF Core — ta sama rejestracja co w Catalogu,
// zero zmian w BuildingBlocks.Messaging.
builder.AddErpMessaging<SalesDbContext>(typeof(SalesDbContext).Assembly);

// Handler jawnie w DI — patrz uzasadnienie w Catalog.Api/Program.cs (Wolverine wymaga
// statycznie rozwiązywalnego grafu zależności, FastEndpoints tworzy handlery z root providera).
builder.Services.AddScoped<ICommandHandler<SetCustomerNameCommand, Guid>, SetCustomerNameCommandHandler>();

// Silnik zadań masowych — trwałe zadania w schemacie `sales`, ten sam mechanizm co w Catalogu.
builder.Services.AddScoped<IJobStore, JobStore<SalesDbContext>>();
builder.Services.AddErpBulkJobs<SalesDbContext>(builder.Configuration);
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<SetCustomerNameCommand>>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseErpApi("Sales");

await app.RunAsync();
