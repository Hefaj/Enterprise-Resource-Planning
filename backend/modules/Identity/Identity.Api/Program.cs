using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Messaging;
using FastEndpoints;
using Identity.Api.Provisioning;
using Identity.Application.Roles;
using Identity.Application.Users;
using Identity.Infrastructure;
using Identity.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP — identyczny z Catalog.Api/Notification.Api/Sales.Api.
builder.Services.AddErpApi("Identity", builder.Configuration);

// Baza, zapytania, uzgodnienie katalogu uprawnień, rola administrator, mapa sygnatur SignalR.
builder.Services.AddIdentityInfrastructure(builder.Configuration);

// Wolverine: outbox spięty z transakcją EF Core — ta sama rejestracja co w pozostałych modułach.
builder.AddErpMessaging<IdentityDbContext>(typeof(IdentityDbContext).Assembly);

// Handlery komend jawnie w DI — patrz uzasadnienie w Catalog.Api/Program.cs. Identity nie ma
// BulkCommandRunnera (brak operacji masowych, patrz IdentityDbContext), więc to jedyne miejsce,
// z którego handlery są w ogóle wołane — przez endpointy w Api, wprost.
builder.Services.AddScoped<ICommandHandler<RoleCreateCommand, Guid>, RoleCreateCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleAddPermissionCommand, Guid>, RoleAddPermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleRemovePermissionCommand, Guid>, RoleRemovePermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleAddMemberCommand, Guid>, RoleAddMemberCommandHandler>();
builder.Services.AddScoped<ICommandHandler<RoleRemoveMemberCommand, Guid>, RoleRemoveMemberCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserAssignRoleCommand, Guid>, UserAssignRoleCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserRevokeRoleCommand, Guid>, UserRevokeRoleCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserGrantPermissionCommand, Guid>, UserGrantPermissionCommandHandler>();
builder.Services.AddScoped<ICommandHandler<UserRevokePermissionCommand, Guid>, UserRevokePermissionCommandHandler>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Dokumentacja API jawnie publiczna — inaczej Swagger UI/NSwag potrzebowałyby tokenu,
    // żeby zobaczyć, jak w ogóle zdobyć token. Fallback policy z ErpAuthExtensions objęłaby
    // też ten endpoint bez tego jawnego wyjątku.
    app.MapOpenApi().AllowAnonymous();
}

// UserProvisioningMiddleware MUSI zobaczyć zweryfikowanego context.User (po auth) i zdążyć
// PRZED dopasowaniem endpointu — stąd hak configureBeforeEndpoints, nie zwykłe app.Use(...)
// gdzieś w tym pliku, gdzie kolejność względem UseFastEndpoints byłaby przypadkowa.
app.UseErpApi("Identity", api => api.UseMiddleware<UserProvisioningMiddleware>());

await app.RunAsync();
