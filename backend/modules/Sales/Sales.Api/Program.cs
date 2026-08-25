using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using Sales.Application.Customers;
using Sales.Infrastructure;
using Sales.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP — identyczny z Catalog.Api/Notification.Api.
builder.Services.AddErpApi("Sales", builder.Configuration);

// Baza, zapytania, seed, mapa sygnatur SignalR.
builder.Services.AddSalesInfrastructure(builder.Configuration);

// Skan zestawów modułu — handlery komend, reguły wsadowe, egzekutory, repozytoria i zapytania.
// Ta sama linijka co w Catalogu i Identity; rośnie kod modułu, nie ten plik.
builder.Services.AddErpModule(
    typeof(CustomerSetNameCommand).Assembly,
    typeof(SalesDbContext).Assembly);

// Wolverine: outbox spięty z transakcją EF Core — ta sama rejestracja co w Catalogu,
// zero zmian w BuildingBlocks.Messaging.
builder.AddErpMessaging<SalesDbContext>(typeof(SalesDbContext).Assembly);

// Silnik zadań masowych — trwałe zadania w schemacie `sales`, ten sam mechanizm co w Catalogu.
// Pipeline komend: logowanie → walidacja wejścia → jednostka pracy → idempotencja.
// Parametr typowy wskazuje, w czyim schemacie leżą klucze idempotencji — muszą być
// w tej samej bazie co dane, żeby klucz i skutek komendy były jednym commitem.
builder.Services.AddErpCommands<SalesDbContext>(builder.Configuration);

builder.Services.AddErpBulkJobs<SalesDbContext>(builder.Configuration);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Dokumentacja API jawnie publiczna — inaczej Swagger UI/NSwag potrzebowałyby tokenu,
    // żeby zobaczyć, jak w ogóle zdobyć token. Fallback policy z ErpAuthExtensions objęłaby
    // też ten endpoint bez tego jawnego wyjątku.
    app.MapOpenApi().AllowAnonymous();
}

app.UseErpApi("Sales");

await app.RunAsync();
