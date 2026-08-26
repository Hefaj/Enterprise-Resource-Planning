using System.Collections.Concurrent;
using Erp.BuildingBlocks.Application.Messaging;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Messaging;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Erp.IntegrationTests;

/// <summary>Kontekst tylko po to, żeby outbox Wolverine'a miał z czym spiąć transakcję.</summary>
internal sealed class OutboxTestDbContext : ErpDbContext
{
    public const string SchemaName = "outbox_tests";

    public OutboxTestDbContext(DbContextOptions<OutboxTestDbContext> options) : base(options)
    {
    }

    protected override string Schema => SchemaName;
}

/// <summary>
/// Licznik doręczeń <b>tego</b> węzła.
///
/// <para>Per węzeł, nie globalnie — bo cała różnica między „dotarło raz" (kolejka serwisu)
/// a „dotarło do wszystkich" (broadcast) leży w rozkładzie doręczeń MIĘDZY węzłami. Wspólny
/// licznik pokazywałby sumę i obie sytuacje wyglądałyby tak samo.</para>
/// </summary>
public sealed class NodeRecorder
{
    public ConcurrentBag<Guid> AggregateChanges { get; } = [];

    public ConcurrentBag<string?> Invalidations { get; } = [];
}

/// <summary>Handler sondujący zdarzenie integracyjne — konwencja wykrywania Wolverine'a.</summary>
public static class AggregateChangedProbeHandler
{
    // Publiczne, bo Wolverine wykrywa handlery przez refleksję po publicznych metodach
    // `Handle`/`HandleAsync` — metoda internal jest dla niego niewidoczna i handler po prostu
    // nigdy się nie uruchamia, bez żadnego błędu przy starcie.
    public static void Handle(AggregateChanged message, NodeRecorder recorder)
    {
        foreach (var uuid in message.Uuids)
        {
            recorder.AggregateChanges.Add(uuid);
        }
    }
}

/// <summary>Odbiorca broadcastu po stronie węzła — odpowiednik cache'u uprawnień w serwisie.</summary>
internal sealed class RecordingPermissionCacheInvalidator : IPermissionCacheInvalidator
{
    private readonly NodeRecorder _recorder;

    public RecordingPermissionCacheInvalidator(NodeRecorder recorder) => _recorder = recorder;

    public Task InvalidateAsync(string? userId, CancellationToken cancellationToken)
    {
        _recorder.Invalidations.Add(userId);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Jeden węzeł: własny host, własny kontener DI, wspólny Postgres i RabbitMQ.
///
/// <para>Dwa takie węzły w jednym procesie testowym są wierne temu, co sprawdzamy: dzielą
/// wyłącznie infrastrukturę, a nie stan w pamięci. Różnica względem dwóch procesów — wspólny
/// GC i wspólny scheduler — nie dotyka żadnego z badanych mechanizmów.</para>
/// </summary>
internal sealed class MessagingNode : IAsyncDisposable
{
    private readonly IHost _host;

    private MessagingNode(IHost host, NodeRecorder recorder)
    {
        _host = host;
        Recorder = recorder;
    }

    public NodeRecorder Recorder { get; }

    public IServiceProvider Services => _host.Services;

    public static async Task<MessagingNode> StartAsync(
        BrokerFixture broker,
        string databaseName,
        string listenQueue,
        CancellationToken cancellationToken)
    {
        var recorder = new NodeRecorder();
        var connectionString = BuildConnectionString(broker, databaseName);

        var builder = Host.CreateApplicationBuilder();

        var logPath = Environment.GetEnvironmentVariable("ERP_NODE_LOG");
        if (!string.IsNullOrWhiteSpace(logPath))
        {
            builder.Logging.SetMinimumLevel(Microsoft.Extensions.Logging.LogLevel.Debug);
            builder.Logging.AddProvider(new FileLoggerProvider(logPath));
        }

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Messaging:ServiceName"] = "MultiNodeTest",
            ["Messaging:RabbitMqConnectionString"] = broker.RabbitConnectionString,
            ["Messaging:PostgresConnectionString"] = connectionString,
            ["Messaging:AutoProvision"] = "true",
            ["Messaging:ListenQueueName"] = listenQueue,
        });

        builder.Services.AddSingleton(recorder);
        builder.Services.AddScoped<IPermissionCacheInvalidator, RecordingPermissionCacheInvalidator>();

        builder.Services.AddDbContext<OutboxTestDbContext>(options =>
            options.UseErpPostgres(connectionString, OutboxTestDbContext.SchemaName));

        builder.AddErpMessaging<OutboxTestDbContext>(typeof(MessagingNode).Assembly);

        var host = builder.Build();
        await host.StartAsync(cancellationToken);

        return new MessagingNode(host, recorder);
    }

    public async ValueTask DisposeAsync()
    {
        await _host.StopAsync(CancellationToken.None);
        _host.Dispose();
    }

    public static string BuildConnectionString(BrokerFixture broker, string databaseName)
        => new Npgsql.NpgsqlConnectionStringBuilder(broker.PostgresConnectionString)
        {
            Database = databaseName,
        }.ConnectionString;
}
