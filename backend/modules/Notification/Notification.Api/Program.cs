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

// ── ROLA REALTIME ────────────────────────────────────────────────────────────────────────────
//
// Jedno ustawienie steruje wszystkim, co z niej wynika. Gdyby operator musiał zgrać `Realtime:Role`
// z `Messaging:ListenQueueName` ręcznie, prędzej czy później postawiłby dwa przekaźniki naraz —
// a wtedy bufor koalescencji i próg „all" liczyłyby się dwukrotnie i nikt by tego nie zauważył
// poza podwojonym ruchem u klienta. Patrz RealtimeRole i docs/backend/multi-instance.md §7.1.
var realtimeRole = builder.Configuration.GetValue("Realtime:Role", RealtimeRole.Both);

if (realtimeRole == RealtimeRole.Hub)
{
    // Hub nie konsumuje z brokera: N hubów na jednej nazwanej kolejce to competing consumers,
    // czyli zdarzenie rozdzielone między instancje zamiast dotarcia do wszystkich klientów.
    builder.Configuration["Messaging:ListenQueueName"] = string.Empty;
}

// Wolverine: w przeciwieństwie do Catalogu, Notification jest też KONSUMENTEM —
// Messaging:ListenQueueName w appsettings włącza nasłuch na własnej kolejce związanej
// z wymianą `erp.events`. Handlery żyją w dwóch zestawach: DB-owe (JobAccepted/Progressed/
// Completed) w Infrastructure, przekaźnik do SignalR w Api — ten drugi potrzebuje
// IHubContext<SyncHub>, którego Infrastructure nie może referencować.
builder.AddErpMessaging<NotificationDbContext>(
    typeof(NotificationDbContext).Assembly,
    Assembly.GetExecutingAssembly());

var signalR = builder.Services.AddSignalR();

// Backplane — jedyne miejsce, w którym system potrzebuje Redisa (SignalR nie ma backplane'u
// na Postgresie). Bez niego wysyłka do grupy dosięga wyłącznie połączeń wiszących na TEJ
// instancji, więc przy wielu hubach część klientów po prostu nic nie dostaje.
//
// Warunkowo, nie na sztywno: pojedyncza instancja (Realtime:Role = Both, czyli dev) ma chodzić
// bez żadnej dodatkowej infrastruktury — to warunek wykonalności całego planu, nie ostrożność.
var redisConnection = builder.Configuration["Realtime:Redis"];

if (!string.IsNullOrWhiteSpace(redisConnection))
{
    signalR.AddStackExchangeRedis(redisConnection, options =>
        // Prefiks kanałów: jeden Redis może obsługiwać kilka środowisk, a domyślna nazwa
        // sprawiłaby, że dev i staging rozgłaszałyby sobie nawzajem zmiany.
        options.Configuration.ChannelPrefix = StackExchange.Redis.RedisChannel.Literal("erp-sync"));
}

// "sub" zamiast domyślnego ClaimTypes.NameIdentifier — patrz SubjectUserIdProvider.
builder.Services.AddSingleton<IUserIdProvider, SubjectUserIdProvider>();
builder.Services.Configure<RealtimeBroadcastOptions>(
    builder.Configuration.GetSection(RealtimeBroadcastOptions.SectionName));
// Rejestrowany bezwarunkowo, również w roli Hub — mimo że tam nikt go nie zawoła. Wolverine
// kompiluje handlery przy starcie i sprawdza, czy ich zależności da się rozwiązać; brak
// rejestracji wywracałby więc start huba na handlerze, który i tak nigdy nie dostanie komunikatu.
// O tym, czy przekaźnik pracuje, decyduje nasłuch kolejki, a nie obecność wpisu w kontenerze.
builder.Services.AddSingleton<RealtimeBroadcaster>();

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
