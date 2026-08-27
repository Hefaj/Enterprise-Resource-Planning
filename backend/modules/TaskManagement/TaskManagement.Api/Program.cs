using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Artifacts;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using JasperFx;
using TaskManagement.Application.Issues;
using TaskManagement.Infrastructure;
using TaskManagement.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP — identyczny z Catalog.Api/Identity.Api/Sales.Api.
builder.Services.AddErpApi("TaskManagement", builder.Configuration);

// Baza, seed, dzierżawa wyłączności, mapa sygnatur SignalR.
builder.Services.AddTaskManagementInfrastructure(builder.Configuration);

// Skan zestawów modułu — handlery komend, reguły wsadowe, egzekutory, repozytoria i zapytania.
// Nowa komenda ani nowe repozytorium nie dopisują tu niczego.
builder.Services.AddErpModule(
    typeof(IssueCreateCommand).Assembly,
    typeof(TaskManagementDbContext).Assembly);

// Wolverine: outbox spięty z transakcją EF Core.
builder.AddErpMessaging<TaskManagementDbContext>(typeof(TaskManagementDbContext).Assembly);

// Pipeline komend: logowanie → walidacja wejścia → jednostka pracy → idempotencja.
// Parametr typowy wskazuje, w czyim schemacie leżą klucze idempotencji — muszą być w tej samej
// bazie co dane, żeby klucz i skutek komendy były jednym commitem.
builder.Services.AddErpCommands<TaskManagementDbContext>(builder.Configuration);

// Silnik zadań masowych — trwałe `job`/`job_item` w schemacie `taskmgmt`. Każda mutacja w tym
// module idzie przez runner, a to on otwiera transakcję chunka, w której licznik klucza
// zgłoszenia i samo zgłoszenie zapisują się razem (docs/backend/task-management.md §4).
builder.Services.AddErpBulkJobs<TaskManagementDbContext>(builder.Configuration);

// Magazyn plików modułu — dwa kubełki (`erp-taskmgmt-artifacts` / `erp-taskmgmt-media`) i konto
// MinIO tego serwisu. Nie ma centralnego mikroserwisu do multimediów: moduł jest właścicielem
// swoich plików, bo referencja i rekord muszą leżeć w jednej transakcji
// (docs/backend/media-storage.md).
builder.Services.AddErpArtifacts(builder.Configuration);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Dokumentacja API jawnie publiczna — inaczej Swagger UI/NSwag potrzebowałyby tokenu,
    // żeby zobaczyć, jak w ogóle zdobyć token.
    app.MapOpenApi().AllowAnonymous();
}

app.UseErpApi("TaskManagement");

return await app.RunJasperFxCommands(args);
