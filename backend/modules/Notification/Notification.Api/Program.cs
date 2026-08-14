using System.Reflection;
using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Messaging;
using Notification.Api.Hubs;
using Notification.Api.Realtime;
using Notification.Infrastructure;
using Notification.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Wspólny bootstrap HTTP: FastEndpoints, Swagger, CORS dla mikrofrontendów (z AllowCredentials
// wymaganym przez negocjację SignalR).
builder.Services.AddErpApi();

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
builder.Services.Configure<RealtimeBroadcastOptions>(
    builder.Configuration.GetSection(RealtimeBroadcastOptions.SectionName));
builder.Services.AddSingleton<RealtimeBroadcaster>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseErpApi();

app.MapHub<SyncHub>(SyncHub.Path);

await app.RunAsync();
