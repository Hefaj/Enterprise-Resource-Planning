using Catalog.Domain.ExportRuns;
using Catalog.Infrastructure.Jobs;
using Catalog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Kryteria akceptacji fazy 1 dla eksportów (<c>docs/backend/multi-instance.md</c> §10, wiersze 2–3).
///
/// <para>Sprawdzany jest <b>mechanizm wyłączności</b>, nie liczba plików w MinIO — i to jest
/// świadome zawężenie. „Dokładnie jeden artefakt" wynika wprost z „dokładnie jeden runner przejmuje
/// przebieg": artefakt powstaje w środku <c>ProcessNextRunAsync</c>, po przejęciu. Dokładanie tu
/// kontenera MinIO, kubełków i pełnego DI Catalogu sprawdziłoby tę samą własność drożej i przy
/// okazji uzależniło wynik od rzeczy, których faza 1 nie zmieniała.</para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ExportRunConcurrencyTests
{
    private readonly PostgresFixture _postgres;

    public ExportRunConcurrencyTests(PostgresFixture postgres) => _postgres = postgres;

    /// <summary>
    /// Dwa runnery sięgające po ten sam oczekujący przebieg: jeden go bierze, drugi odchodzi
    /// z pustymi rękami. Bez tego powstałyby <b>dwa artefakty</b> dla jednego przebiegu, z czego
    /// jeden osierocony w magazynie — bez wiersza, który by o nim wiedział.
    /// </summary>
    [Fact]
    public async Task Przebieg_przejmuje_dokladnie_jeden_runner()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = await CatalogDatabase.CreateAsync(_postgres, cancellationToken);

        var now = DateTimeOffset.UtcNow;

        await using (var seed = database.NewContext())
        {
            seed.ExportRuns.Add(ExportRun.Create(Guid.CreateVersion7(), "xml", null, now));
            await seed.SaveChangesAsync(cancellationToken);
        }

        await using var first = database.NewContext();
        await using var second = database.NewContext();

        var claimedByFirst = await ExportRunner.ClaimNextRunAsync(first, now, cancellationToken);
        var claimedBySecond = await ExportRunner.ClaimNextRunAsync(second, now, cancellationToken);

        claimedByFirst.ShouldNotBeNull();
        claimedByFirst.Status.ShouldBe(ExportRunStatus.Running);
        claimedByFirst.HeartbeatAt.ShouldNotBeNull("Przejęcie nie zapaliło znaku życia — odzysk nie miałby czego mierzyć.");

        claimedBySecond.ShouldBeNull("Drugi runner przejął przebieg już wykonywany przez pierwszego.");
    }

    /// <summary>
    /// Przebieg po runnerze, który przestał dawać znaki życia, wraca do puli — i może zostać
    /// przejęty ponownie. To naprawia usterkę obecną <b>także przy jednej instancji</b>: dotąd
    /// padnięcie runnera zostawiało przebieg w stanie „w toku" na zawsze.
    /// </summary>
    [Fact]
    public async Task Przebieg_po_martwym_runnerze_wraca_do_puli()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = await CatalogDatabase.CreateAsync(_postgres, cancellationToken);

        var start = DateTimeOffset.UtcNow;

        await using (var seed = database.NewContext())
        {
            seed.ExportRuns.Add(ExportRun.Create(Guid.CreateVersion7(), "xml", null, start));
            await seed.SaveChangesAsync(cancellationToken);
        }

        await using (var claiming = database.NewContext())
        {
            (await ExportRunner.ClaimNextRunAsync(claiming, start, cancellationToken)).ShouldNotBeNull();
        }

        // Runner „padł": znak życia zostaje na zawsze w chwili przejęcia, a zegar idzie dalej.
        var afterTimeout = start + ExportRunner.HeartbeatTimeout + TimeSpan.FromMinutes(1);

        await using (var reclaiming = database.NewContext())
        {
            var reclaimed = await ExportRunner.ReclaimAbandonedRunsAsync(
                reclaiming, afterTimeout, NullLogger.Instance, cancellationToken);

            reclaimed.ShouldBe(1, "Porzucony przebieg nie wrócił do puli po przekroczeniu progu.");
        }

        await using (var next = database.NewContext())
        {
            var reclaimedRun = await ExportRunner.ClaimNextRunAsync(next, afterTimeout, cancellationToken);
            reclaimedRun.ShouldNotBeNull("Odzyskany przebieg nie daje się podjąć ponownie.");
        }
    }

    /// <summary>
    /// Odzysk nie może ruszać przebiegu, który <b>żyje</b> — fałszywy odzysk to dwa runnery nad
    /// jednym eksportem, czyli dokładnie ten osierocony artefakt, przed którym się bronimy.
    /// </summary>
    [Fact]
    public async Task Zywy_przebieg_nie_jest_odzyskiwany()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = await CatalogDatabase.CreateAsync(_postgres, cancellationToken);

        var start = DateTimeOffset.UtcNow;

        await using (var seed = database.NewContext())
        {
            seed.ExportRuns.Add(ExportRun.Create(Guid.CreateVersion7(), "xml", null, start));
            await seed.SaveChangesAsync(cancellationToken);
        }

        await using (var claiming = database.NewContext())
        {
            (await ExportRunner.ClaimNextRunAsync(claiming, start, cancellationToken)).ShouldNotBeNull();
        }

        await using var reclaiming = database.NewContext();

        var reclaimed = await ExportRunner.ReclaimAbandonedRunsAsync(
            reclaiming,
            start + ExportRunner.HeartbeatTimeout - TimeSpan.FromMinutes(1),
            NullLogger.Instance,
            cancellationToken);

        reclaimed.ShouldBe(0, "Odzysk zabrał przebieg runnerowi, który wciąż dawał znaki życia.");
    }
}
