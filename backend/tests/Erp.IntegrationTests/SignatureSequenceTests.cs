using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Notification.Infrastructure.Persistence;
using Notification.Infrastructure.Realtime;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Kryterium akceptacji fazy 4 (<c>docs/architecture/multi-instance.md</c> §10): po restarcie
/// przekaźnika <c>lastSeenSequence</c> <b>nie cofa się</b>, a wykrywanie luki działa dalej.
///
/// <para>Dopóki licznik i połączenia ginęły razem, licznik w pamięci był poprawny. Po rozdzieleniu
/// ról restart przekaźnika nie zrywa połączeń — te wiszą na hubach — więc wyzerowany licznik
/// zacząłby wydawać numery, które klient z <c>lastSeenSequence = 850</c> już widział. Przy braku
/// ponownej subskrypcji luka nie zostałaby zauważona w ogóle, czyli dokładnie ten przypadek,
/// przed którym mechanizm miał chronić.</para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class SignatureSequenceTests
{
    private readonly PostgresFixture _postgres;

    public SignatureSequenceTests(PostgresFixture postgres) => _postgres = postgres;

    /// <summary>
    /// Licznik przeżywa proces, który go zwiększa. „Restart przekaźnika" to tutaj nowy kontekst
    /// i nowa instancja magazynu — czyli wszystko, co przy prawdziwym restarcie powstaje od nowa.
    /// </summary>
    [Fact]
    public async Task Licznik_przezywa_restart_przekaznika()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await CreateMigratedDatabaseAsync(cancellationToken);

        const string signature = "catalog.product";

        await using (var relay = NewContext(connectionString))
        {
            var store = new PostgresSignatureSequenceStore(relay);

            for (var i = 1; i <= 5; i++)
            {
                (await store.NextAsync(signature, cancellationToken)).ShouldBe(i);
            }
        }

        // Przekaźnik wstaje od nowa — licznik ma podjąć tam, gdzie skończył.
        await using (var restarted = NewContext(connectionString))
        {
            var store = new PostgresSignatureSequenceStore(restarted);

            (await store.CurrentAsync(signature, cancellationToken)).ShouldBe(5);
            (await store.NextAsync(signature, cancellationToken)).ShouldBe(6);
        }
    }

    /// <summary>
    /// Sygnatura, dla której nic jeszcze nie nadeszło, ma dawać zero — a nie błąd. Klient
    /// z niezerowym <c>lastSeenSequence</c> zobaczy wtedy rozjazd i przeładuje dane, co jest
    /// właściwym zachowaniem po wyczyszczeniu tabeli.
    /// </summary>
    [Fact]
    public async Task Nieznana_sygnatura_daje_zero()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await CreateMigratedDatabaseAsync(cancellationToken);

        await using var context = NewContext(connectionString);
        var store = new PostgresSignatureSequenceStore(context);

        (await store.CurrentAsync("sales.customer", cancellationToken)).ShouldBe(0);
    }

    /// <summary>
    /// Inkrementacja jest atomowa, więc licznik pozostaje poprawny nawet wtedy, gdy przekaźników
    /// przejściowo jest dwóch — a to jest realny stan przy przełączaniu roli albo w wariancie
    /// z elekcją lidera. Odczyt-modyfikacja-zapis gubiłby tu numery po cichu.
    /// </summary>
    [Fact]
    public async Task Rownolegle_inkrementacje_nie_gubia_numerow()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await CreateMigratedDatabaseAsync(cancellationToken);

        const string signature = "catalog.category";
        const int concurrency = 20;

        using var gate = new SemaphoreSlim(0, concurrency);

        var writers = Enumerable.Range(0, concurrency)
            .Select(_ => Task.Run(async () =>
            {
                await using var context = NewContext(connectionString);
                var store = new PostgresSignatureSequenceStore(context);

                await gate.WaitAsync(cancellationToken);
                return await store.NextAsync(signature, cancellationToken);
            }, cancellationToken))
            .ToList();

        gate.Release(concurrency);

        var issued = await Task.WhenAll(writers);

        issued.Distinct().Count().ShouldBe(concurrency, "Ten sam numer sekwencji wydano dwa razy.");
        issued.Order().ShouldBe(Enumerable.Range(1, concurrency).Select(i => (long)i));
    }

    private async Task<string> CreateMigratedDatabaseAsync(CancellationToken cancellationToken)
    {
        var connectionString = await _postgres.CreateDatabaseAsync("notification", cancellationToken);

        await using var context = NewContext(connectionString);
        await context.Database.MigrateAsync(cancellationToken);

        return connectionString;
    }

    private static NotificationDbContext NewContext(string connectionString)
    {
        var builder = new DbContextOptionsBuilder<NotificationDbContext>();
        builder.UseErpPostgres(
            connectionString,
            NotificationDbContext.SchemaName,
            typeof(NotificationDbContext).Assembly.GetName().Name);

        return new NotificationDbContext(builder.Options);
    }
}
