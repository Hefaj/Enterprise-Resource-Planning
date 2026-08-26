using Erp.BuildingBlocks.Api.Auth;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Messaging;
using Identity.Api.Auth;
using Identity.Application.Users;
using Identity.Infrastructure.Jobs;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure;
using JasperFx;

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

// Skan zestawów modułu: 10 handlerów komend, 10 egzekutorów zadań masowych, 6 reguł wsadowych,
// 2 walidatory, repozytoria i zapytania — wszystko, co wcześniej stało tu wypisane z ręki.
// Nowa komenda albo reguła nie dotyka już tego pliku.
builder.Services.AddErpModule(
    typeof(UserAddRoleCommand).Assembly,
    typeof(IdentityDbContext).Assembly);

// Nadpisuje rejestrację z AddErpApi (HttpPermissionProvider) — Identity czyta swoją własną bazę
// wprost zamiast pytać samego siebie przez sieć. Musi być PO AddErpApi/AddIdentityInfrastructure:
// w Microsoft.Extensions.DependencyInjection wygrywa OSTATNIA rejestracja danego interfejsu.
builder.Services.AddScoped<IPermissionProvider, IdentityInProcessPermissionProvider>();

// Sprząta wygasłe nadania ról co 5 minut (Faza 6) — patrz ExpiredGrantCleanupService.
builder.Services.AddHostedService<ExpiredGrantCleanupService>();

// Wolverine: outbox spięty z transakcją EF Core — ta sama rejestracja co w pozostałych modułach.
builder.AddErpMessaging<IdentityDbContext>(typeof(IdentityDbContext).Assembly);

// Silnik zadań masowych: trwałe zadania w schemacie `identity`, wznawiane po restarcie.
// Pipeline komend: logowanie → walidacja wejścia → jednostka pracy → idempotencja.
// Parametr typowy wskazuje, w czyim schemacie leżą klucze idempotencji — muszą być
// w tej samej bazie co dane, żeby klucz i skutek komendy były jednym commitem.
builder.Services.AddErpCommands<IdentityDbContext>(builder.Configuration);

builder.Services.AddErpBulkJobs<IdentityDbContext>(builder.Configuration);

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

// ── URUCHOMIENIE ─────────────────────────────────────────────────────────────────────────────
//
// `RunJasperFxCommands`, a nie `RunAsync`: bez argumentów zachowuje się identycznie (podnosi
// serwis), ale wystawia narzędzia wiersza poleceń Wolverine'a — przede wszystkim
// `dotnet run -- codegen write`, którym generuje się kod handlerów z wyprzedzeniem dla trybu
// `Messaging:PrecompiledHandlers`. Bez tego przełącznika nie da się użyć, bo nie ma czym
// wytworzyć kodu, którego oczekuje.
return await app.RunJasperFxCommands(args);
