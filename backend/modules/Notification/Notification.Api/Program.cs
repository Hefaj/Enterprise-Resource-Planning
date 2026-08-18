using System.Reflection;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Messaging;
using Microsoft.AspNetCore.SignalR;
using Notification.Api.Hubs;
using Notification.Api.Realtime;
using Notification.Infrastructure;
using Notification.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP: FastEndpoints, Swagger, CORS dla mikrofrontendów (z AllowCredentials
// wymaganym przez negocjację SignalR).
builder.Services.AddErpApi("Notification", builder.Configuration);

// Baza repliki zadań + zapytania + mapa sygnatur SignalR.
builder.Services.AddNotificationInfrastructure(builder.Configuration);

// Wolverine: w przeciwieństwie do Catalogu, Notification jest też KONSUMENTEM —
// Messaging:ListenQueueName w appsettings włącza nasłuch na własnej kolejce związanej
// z wymianą `erp.events`. Handlery żyją w dwóch zestawach: DB-owe (JobAccepted/Progressed/
// Completed) w Infrastructure, przekaźnik do SignalR w Api — ten drugi potrzebuje
// IHubContext<SyncHub>, którego Infrastructure nie może referencować.
builder.AddErpMessaging<NotificationDbContext>(
    typeof(NotificationDbContext).Assembly,
    Assembly.GetExecutingAssembly());

builder.Services.AddSignalR();
// "sub" zamiast domyślnego ClaimTypes.NameIdentifier — patrz SubjectUserIdProvider.
builder.Services.AddSingleton<IUserIdProvider, SubjectUserIdProvider>();
builder.Services.Configure<RealtimeBroadcastOptions>(
    builder.Configuration.GetSection(RealtimeBroadcastOptions.SectionName));
builder.Services.AddSingleton<RealtimeBroadcaster>();
builder.Services.AddSingleton<SignatureSequenceTracker>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Dokumentacja API jawnie publiczna — inaczej Swagger UI/NSwag potrzebowałyby tokenu,
    // żeby zobaczyć, jak w ogóle zdobyć token. Fallback policy z ErpAuthExtensions objęłaby
    // też ten endpoint bez tego jawnego wyjątku.
    app.MapOpenApi().AllowAnonymous();
}

app.UseErpApi("Notification");

app.MapHub<SyncHub>(SyncHub.Path);

await app.RunAsync();
