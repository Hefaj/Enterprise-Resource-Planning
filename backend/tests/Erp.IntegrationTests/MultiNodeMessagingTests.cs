using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Messaging;
using Erp.BuildingBlocks.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Dwa węzły Wolverine'a nad jednym Postgresem i jednym RabbitMQ — kryteria akceptacji faz 3 i 5
/// (<c>docs/architecture/multi-instance.md</c> §10).
///
/// <para>Te dwa testy razem opisują <b>całą</b> politykę routingu tego systemu, w jej dwóch
/// przeciwstawnych trybach: zdarzenie integracyjne to <i>praca do wykonania</i> i ma trafić do
/// jednego węzła, a unieważnienie cache'u to <i>rozgłoszenie</i> i ma trafić do wszystkich.
/// Pomylenie ich jest ciche w obie strony — praca wykonana N razy albo cache wyczyszczony
/// w jednym procesie z N — więc obie własności mają własny dowód.</para>
/// </summary>
[Collection(BrokerCollection.Name)]
public sealed class MultiNodeMessagingTests
{
    private readonly BrokerFixture _broker;

    public MultiNodeMessagingTests(BrokerFixture broker) => _broker = broker;

    /// <summary>
    /// <b>Faza 5.1 — Wolverine wielowęzłowo.</b> Plan zakładał, że outbox na Postgresie „powinien"
    /// działać z wieloma węzłami, i wprost odmawiał opierania się na tym słowie. Test sprawdza
    /// najbardziej prawdopodobny objaw braku elekcji dla agentów trwałości: <b>kopertę wysłaną
    /// dwa razy</b>. Publikacja idzie przez outbox (ten sam <c>IIntegrationEventPublisher</c>, co
    /// w produkcji), a nie wprost na szynę, bo to właśnie odzysk z outboxu jest badanym ryzykiem.
    /// </summary>
    [Fact]
    public async Task Zdarzenie_integracyjne_dociera_dokladnie_raz_mimo_dwoch_wezlow()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var database = await CreateDatabaseAsync(cancellationToken);
        const int messageCount = 50;

        await using var nodeA = await MessagingNode.StartAsync(_broker, database, "multinode.events", cancellationToken);
        await using var nodeB = await MessagingNode.StartAsync(_broker, database, "multinode.events", cancellationToken);

        var expected = new List<Guid>(messageCount);

        for (var i = 0; i < messageCount; i++)
        {
            var uuid = Guid.CreateVersion7();
            expected.Add(uuid);

            await PublishThroughOutboxAsync(
                nodeA,
                new AggregateChanged("catalog.product", [uuid], ChangeType.Upserted, Guid.CreateVersion7(), DateTimeOffset.UtcNow),
                cancellationToken);
        }

        await WaitUntilAsync(
            () => nodeA.Recorder.AggregateChanges.Count + nodeB.Recorder.AggregateChanges.Count >= messageCount,
            cancellationToken);

        // Chwila wyczekiwania PO osiągnięciu kompletu: duplikat przychodzi z opóźnieniem
        // (agent odzysku), więc test kończący się na „już wszystko jest" by go nie zobaczył.
        await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);

        var delivered = nodeA.Recorder.AggregateChanges.Concat(nodeB.Recorder.AggregateChanges).ToList();

        delivered.Count.ShouldBe(messageCount, "Koperta doręczona więcej niż raz — agent odzysku dubluje wysyłkę.");
        delivered.Order().ShouldBe(expected.Order());
    }

    /// <summary>
    /// <b>Faza 3 — unieważnienie dociera do CAŁEJ floty.</b> Wymiana <c>erp.events</c> wiąże jedną
    /// nazwaną kolejkę per serwis, więc N instancji to <i>competing consumers</i> i sygnał trafiłby
    /// do jednej z nich — a wtedy druga instancja przepuszczałaby odebrane uprawnienie do końca
    /// TTL. Osobna wymiana <c>erp.broadcast</c> z kolejką per instancja zamyka to okno; test
    /// wykazuje, że oba węzły faktycznie dostają ten sam sygnał.
    /// </summary>
    [Fact]
    public async Task Uniewaznienie_uprawnien_dociera_do_obu_wezlow()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var database = await CreateDatabaseAsync(cancellationToken);

        await using var nodeA = await MessagingNode.StartAsync(_broker, database, "broadcast.events", cancellationToken);
        await using var nodeB = await MessagingNode.StartAsync(_broker, database, "broadcast.events", cancellationToken);

        const string userId = "01a03dd0-0000-7000-8000-000000000001";

        await PublishThroughOutboxAsync(
            nodeA,
            new PermissionsInvalidated(userId, DateTimeOffset.UtcNow),
            cancellationToken);

        await WaitUntilAsync(
            () => nodeA.Recorder.Invalidations.Count >= 1 && nodeB.Recorder.Invalidations.Count >= 1,
            cancellationToken);

        nodeA.Recorder.Invalidations.ShouldContain(userId);
        nodeB.Recorder.Invalidations.ShouldContain(userId, "Druga instancja nie wyczyściła cache'u — "
            + "sygnał poszedł kolejką roboczą zamiast rozgłoszeniem.");

        // Zdarzenie rozgłaszane NIE może przy okazji wpaść na kolejkę serwisu: tam byłoby
        // komunikatem bez handlera i lądowałoby w dead letters przy każdej zmianie uprawnień.
        nodeA.Recorder.AggregateChanges.ShouldBeEmpty();
        nodeB.Recorder.AggregateChanges.ShouldBeEmpty();
    }

    // ── Pomocnicze ──────────────────────────────────────────────────────────────────────────

    private async Task<string> CreateDatabaseAsync(CancellationToken cancellationToken)
    {
        var database = $"node_{Guid.NewGuid():N}";

        await using var admin = new NpgsqlConnection(_broker.PostgresConnectionString);
        await admin.OpenAsync(cancellationToken);

        await using var command = admin.CreateCommand();
        command.CommandText = $"CREATE DATABASE \"{database}\"";
        await command.ExecuteNonQueryAsync(cancellationToken);

        return database;
    }

    /// <summary>
    /// Publikuje tak, jak robi to komenda w produkcji: koperta ląduje w outboxie i wychodzi
    /// dopiero po commicie. Ścieżka wprost na szynę pomijałaby dokładnie ten mechanizm, którego
    /// zachowanie przy dwóch węzłach jest tu przedmiotem badania.
    /// </summary>
    private static async Task PublishThroughOutboxAsync(
        MessagingNode node,
        object integrationEvent,
        CancellationToken cancellationToken)
    {
        using var scope = node.Services.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<OutboxTestDbContext>();
        await db.Database.EnsureCreatedAsync(cancellationToken);

        var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();

        await publisher.PublishAsync(integrationEvent, cancellationToken);
        await publisher.SaveChangesAndFlushAsync(cancellationToken);
    }

    private static async Task WaitUntilAsync(Func<bool> condition, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(60);

        while (DateTimeOffset.UtcNow < deadline)
        {
            if (condition())
            {
                return;
            }

            await Task.Delay(100, cancellationToken);
        }

        throw new TimeoutException("Komunikaty nie dotarły w wyznaczonym czasie.");
    }
}
