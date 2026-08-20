using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Api.Auth;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using FastEndpoints;
using Identity.Api.Auth;
using Identity.Application.Roles;
using Identity.Application.Users;
using Identity.Infrastructure;
using Identity.Infrastructure.Jobs;
using Identity.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP — identyczny z Catalog.Api/Notification.Api/Sales.Api. Inaczej niż
// przed Fazą 6, Identity TERAZ włącza enablePermissionClaims: true — pętla samo-wywołania przez
// HTTP, dla której ta flaga była wcześniej wyłączona (patrz uzasadnienie w ErpApiExtensions.
// AddErpApi), nie zachodzi już od Fazy 6: IPermissionProvider Identity to
// IdentityInProcessPermissionProvider (rejestrowany niżej, PO AddErpApi — ostatnia rejestracja
// wygrywa), który czyta własną bazę wprost, bez HTTP.
builder.Services.AddErpApi("Identity", builder.Configuration, enablePermissionClaims: true);

// Wymuszone wylogowanie (Faza 6) — jedyny mikroserwis, który woła Admin API Keycloaka.
builder.Services.AddErpKeycloakAdmin(builder.Configuration);

// Baza, zapytania, uzgodnienie katalogu uprawnień, rola administrator, mapa sygnatur SignalR.
builder.Services.AddIdentityInfrastructure(builder.Configuration);

// Nadpisuje rejestrację z AddErpApi (HttpPermissionProvider) — Identity czyta swoją własną bazę
// wprost zamiast pytać samego siebie przez sieć. Musi być PO AddErpApi/AddIdentityInfrastructure:
// w Microsoft.Extensions.DependencyInjection wygrywa OSTATNIA rejestracja danego interfejsu.
builder.Services.AddScoped<IPermissionProvider, IdentityInProcessPermissionProvider>();

// Sprząta wygasłe nadania ról co 5 minut (Faza 6) — patrz ExpiredGrantCleanupService.
builder.Services.AddHostedService<ExpiredGrantCleanupService>();

// Wolverine: outbox spięty z transakcją EF Core — ta sama rejestracja co w pozostałych modułach.
builder.AddErpMessaging<IdentityDbContext>(typeof(IdentityDbContext).Assembly);

// Silnik zadań masowych: trwałe zadania w schemacie `identity`, wznawiane po restarcie.
builder.Services.AddScoped<IJobStore, JobStore<IdentityDbContext>>();
builder.Services.AddErpBulkJobs<IdentityDbContext>(builder.Configuration);

// Reguły wsadowe użytkowników i ich kompozycja (Faza 1 przejścia opisanego w
// docs/backend/identity-bulk-migration.md). Endpointy operacji masowych wołają wyłącznie
// walidator — to on wie, jakie reguły obowiązują dla której operacji
// (BatchEndpointBase.ValidateTargetsAsync). Role zostają na komendach synchronicznych do Fazy 3.
builder.Services.AddScoped<UserMustExistRule>();
builder.Services.AddScoped<ReferencedRoleMustExistRule>();
builder.Services.AddScoped<PermissionCodeMustExistRule>();
builder.Services.AddScoped<UserBatchValidator>();

// Handlery komend jawnie w DI — patrz uzasadnienie w Catalog.Api/Program.cs. Komendy `role/*`
// zapisują same przez IUnitOfWork (patrz RoleCommands.cs) do czasu Fazy 3; komendy `user/*`
// od Fazy 2 idą wyłącznie przez runnera, który zapisuje raz na chunk.
builder.Services.AddScoped<ICommandHandler<RoleCreateCommand, Guid>, RoleCreateCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleAddPermissionCommand, Guid>, RoleAddPermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleRemovePermissionCommand, Guid>, RoleRemovePermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleAddMemberCommand, Guid>, RoleAddMemberCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleRemoveMemberCommand, Guid>, RoleRemoveMemberCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserAssignRoleCommand, Guid>, UserAssignRoleCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserRevokeRoleCommand, Guid>, UserRevokeRoleCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserGrantPermissionCommand, Guid>, UserGrantPermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserRevokePermissionCommand, Guid>, UserRevokePermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserForceLogoutCommand, Guid>, UserForceLogoutCommandHandler>();

// Egzekutory per typ komendy — runner odnajduje je po nazwie typu zapisanej w zadaniu.
// Tylko `user/*`: `role/*` dołączy w Fazie 3, gdy przejdzie na BatchEndpointBase.
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<UserAssignRoleCommand>>();
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<UserRevokeRoleCommand>>();
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<UserGrantPermissionCommand>>();
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<UserRevokePermissionCommand>>();
builder.Services.AddScoped<IBulkCommandExecutor, BulkCommandExecutor<UserForceLogoutCommand>>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Dokumentacja API jawnie publiczna — inaczej Swagger UI/NSwag potrzebowałyby tokenu,
    // żeby zobaczyć, jak w ogóle zdobyć token. Fallback policy z ErpAuthExtensions objęłaby
    // też ten endpoint bez tego jawnego wyjątku.
    app.MapOpenApi().AllowAnonymous();
}

// Od Fazy 6 JIT provisioning NIE idzie przez middleware — dzieje się wewnątrz
// IdentityInProcessPermissionProvider, wołane z PermissionClaimsTransformation zaraz po
// walidacji JWT (patrz uzasadnienie na IdentityInProcessPermissionProvider). Dawny hak
// configureBeforeEndpoints biegł PO tej transformacji, więc pierwsze żądanie nowego
// użytkownika widziałoby jeszcze nieistniejące konto w chwili odczytu uprawnień — stąd ta
// zmiana. Hak w ErpApiExtensions.UseErpApi zostaje jako generyczny punkt rozszerzenia,
// Identity po prostu już go nie potrzebuje.
app.UseErpApi("Identity");

await app.RunAsync();
