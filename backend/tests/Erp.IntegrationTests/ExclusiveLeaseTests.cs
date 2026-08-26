using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Dowód dla <see cref="IExclusiveLease"/> — fundamentu, na którym stoją fazy 1 i 2
/// (<c>docs/backend/multi-instance.md</c> §3.1).
///
/// <para>Trzy własności są tu sprawdzane osobno, bo każda niesie inną obietnicę: wyłączność
/// (nikt drugi nie wejdzie), zwolnienie (po oddaniu wchodzi następny) i — najważniejsza —
/// <b>samoczynne zwolnienie przy śmierci właściciela</b>, czyli to, dla czego wybrano advisory
/// lock zamiast kolumny z terminem.</para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ExclusiveLeaseTests
{
    private readonly PostgresFixture _postgres;

    public ExclusiveLeaseTests(PostgresFixture postgres) => _postgres = postgres;

    private IExclusiveLease CreateLease()
    {
        var builder = new DbContextOptionsBuilder<LeaseDbContext>();
        builder.UseErpPostgres(_postgres.ConnectionString, LeaseDbContext.SchemaName);

        return new PostgresExclusiveLease<LeaseDbContext>(
            new LeaseDbContext(builder.Options),
            NullLogger<PostgresExclusiveLease<LeaseDbContext>>.Instance);
    }

    [Fact]
    public async Task Druga_instancja_nie_dostaje_zajetej_dzierzawy()
    {
        var resource = $"test:{Guid.NewGuid():N}";

        await using var first = await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken);
        first.ShouldNotBeNull();

        var second = await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken);
        second.ShouldBeNull("Dzierżawa nie jest wyłączna — dwie instancje wykonałyby tę samą pracę.");
    }

    [Fact]
    public async Task Zwolniona_dzierzawa_wraca_do_puli()
    {
        var resource = $"test:{Guid.NewGuid():N}";

        var first = await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken);
        first.ShouldNotBeNull();
        await first.DisposeAsync();

        await using var second = await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken);
        second.ShouldNotBeNull();
    }

    /// <summary>
    /// Dzierżawy na różne zasoby nie mogą się blokować — inaczej dwie niezależne usługi tła
    /// wykluczałyby się nawzajem bez powodu.
    /// </summary>
    [Fact]
    public async Task Rozne_zasoby_nie_koliduja()
    {
        await using var first = await CreateLease()
            .TryAcquireAsync($"test:a:{Guid.NewGuid():N}", TestContext.Current.CancellationToken);
        await using var second = await CreateLease()
            .TryAcquireAsync($"test:b:{Guid.NewGuid():N}", TestContext.Current.CancellationToken);

        first.ShouldNotBeNull();
        second.ShouldNotBeNull();
    }

    /// <summary>
    /// <b>Sedno wyboru advisory locka.</b> Właściciel, który zginął, nie zostawia osieroconej
    /// dzierżawy: lock żyje tak długo, jak sesja TCP, więc zerwanie połączenia zwalnia go bez
    /// niczyjego udziału — bez bicia serca, bez tolerancji na rozjazd zegarów i bez procedury
    /// odzysku, których wymagałaby kolumna <c>locked_until</c>.
    ///
    /// <para>Zabicie procesu symulujemy zerwaniem połączenia, bo to jest dokładnie ten mechanizm,
    /// który zadziała przy padnięciu instancji — Postgres nie widzi różnicy między procesem,
    /// który zginął, a takim, który zamknął gniazdo.</para>
    /// </summary>
    [Fact]
    public async Task Smierc_wlasciciela_zwalnia_dzierzawe_sama()
    {
        var resource = $"test:{Guid.NewGuid():N}";
        var builder = new NpgsqlConnectionStringBuilder(_postgres.ConnectionString) { Pooling = false };

        var owner = new NpgsqlConnection(builder.ConnectionString);
        await owner.OpenAsync(TestContext.Current.CancellationToken);

        await using (var command = new NpgsqlCommand("SELECT pg_try_advisory_lock(hashtext(@r)::bigint)", owner))
        {
            command.Parameters.AddWithValue("r", resource);
            (await command.ExecuteScalarAsync(TestContext.Current.CancellationToken)).ShouldBe(true);
        }

        // Zajęte, dopóki właściciel żyje.
        (await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken)).ShouldBeNull();

        // „Proces padł" — sesja znika bez żadnego `pg_advisory_unlock`.
        await owner.DisposeAsync();

        await using var next = await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken);
        next.ShouldNotBeNull("Advisory lock nie zwolnił się po zerwaniu sesji — dzierżawa osierocona.");
    }

    /// <summary>
    /// Wariant blokujący (praca startowa): instancja B nie pomija kroku, tylko czeka i wchodzi
    /// dopiero po zwolnieniu. To jest różnica, od której zależy, czy druga instancja wystartuje
    /// na zmigrowanej bazie, czy na w połowie przygotowanej.
    /// </summary>
    [Fact]
    public async Task Wariant_blokujacy_czeka_zamiast_pomijac()
    {
        var resource = $"test:{Guid.NewGuid():N}";

        var first = await CreateLease().TryAcquireAsync(resource, TestContext.Current.CancellationToken);
        first.ShouldNotBeNull();

        var waiting = CreateLease().AcquireAsync(resource, TestContext.Current.CancellationToken);

        // Dopóki pierwszy trzyma, drugi ma wisieć — nie dostać null, nie wyjść.
        var finishedTooEarly = await Task.WhenAny(waiting, Task.Delay(500, TestContext.Current.CancellationToken));
        finishedTooEarly.ShouldNotBe(waiting, "Dzierżawa blokująca nie zaczekała — pominęła krok startowy.");

        await first.DisposeAsync();

        await using var second = await waiting.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        second.ShouldNotBeNull();
    }
}

/// <summary>Minimalny kontekst — dzierżawa nie dotyka żadnej tabeli, potrzebuje tylko połączenia.</summary>
internal sealed class LeaseDbContext : ErpDbContext
{
    public const string SchemaName = "lease_tests";

    public LeaseDbContext(DbContextOptions<LeaseDbContext> options) : base(options)
    {
    }

    protected override string Schema => SchemaName;
}
