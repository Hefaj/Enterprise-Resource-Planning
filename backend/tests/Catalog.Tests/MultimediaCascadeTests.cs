using Catalog.Application.Abstractions;
using Catalog.Application.Multimedia;
using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Kaskada po odpięciu multimediów od produktu (<c>docs/backend/media-storage.md</c> §4c).
///
/// <para>To jedyne miejsce w systemie, w którym plik użytkownika znika bez jawnej komendy
/// „usuń zasób", więc granica między „znika kaskadą" a „zostaje w bibliotece" musi być
/// przypięta testem, a nie tylko komentarzem.</para>
/// </summary>
public class MultimediaCascadeTests
{
    private static readonly Guid ProductUuid = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid AssetUuid = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    private static readonly Guid ArtifactUuid = Guid.Parse("cccccccc-0000-0000-0000-000000000001");

    private static MultimediaAsset Asset(MultimediaOwnership ownership)
        => MultimediaAsset.CreateUploaded(
            AssetUuid, ArtifactUuid, "zdjecie.jpg", "image/jpeg", 1024,
            sortOrder: 0, createdAt: DateTimeOffset.UnixEpoch, ownership: ownership);

    private static (MultimediaCascade Cascade, FakeMultimediaRepository Repository, FakePublisher Publisher) Setup(
        MultimediaAsset asset,
        int referencesElsewhere)
    {
        var repository = new FakeMultimediaRepository { Assets = { [asset.Uuid] = asset } };
        var queries = new FakeMultimediaQueries
        {
            ReferencesExcludingOwner = referencesElsewhere > 0
                ? new Dictionary<Guid, int> { [asset.Uuid] = referencesElsewhere }
                : [],
        };
        var publisher = new FakePublisher();

        return (new MultimediaCascade(repository, queries, publisher), repository, publisher);
    }

    [Fact]
    public async Task Zasob_wlasny_bez_innych_referencji_znika_razem_z_ostatnia()
    {
        var (cascade, repository, publisher) = Setup(Asset(MultimediaOwnership.Owned), referencesElsewhere: 0);

        await cascade.ApplyAsync(ProductUuid, [AssetUuid], CancellationToken.None);

        repository.Removed.ShouldBe([AssetUuid]);

        // Plik kasuje się przez outbox, w tej samej transakcji — nie wywołaniem magazynu (§4b).
        var deletion = publisher.Published.OfType<ArtifactDeletionRequested>().ShouldHaveSingleItem();
        deletion.ArtifactUuid.ShouldBe(ArtifactUuid);
        deletion.StoreKey.ShouldBe(ArtifactStoreKeys.Media);
    }

    /// <summary>
    /// Sedno rozstrzygnięcia z §4c: „nikt tego teraz nie używa" nie znaczy „to śmieć".
    /// Odpięcie zdjęcia od produktu, żeby przepiąć je do innego, nie jest prośbą o skasowanie.
    /// </summary>
    [Fact]
    public async Task Pozycja_biblioteki_zostaje_mimo_zerowej_liczby_referencji()
    {
        var (cascade, repository, publisher) = Setup(Asset(MultimediaOwnership.Library), referencesElsewhere: 0);

        await cascade.ApplyAsync(ProductUuid, [AssetUuid], CancellationToken.None);

        repository.Removed.ShouldBeEmpty();
        publisher.Published.ShouldBeEmpty();
    }

    [Fact]
    public async Task Zasob_wlasny_wskazywany_przez_inny_produkt_zostaje()
    {
        var (cascade, repository, publisher) = Setup(Asset(MultimediaOwnership.Owned), referencesElsewhere: 1);

        await cascade.ApplyAsync(ProductUuid, [AssetUuid], CancellationToken.None);

        repository.Removed.ShouldBeEmpty();
        publisher.Published.ShouldBeEmpty();
    }

    [Fact]
    public async Task Puste_odpiecie_nie_pyta_bazy_o_nic()
    {
        var (cascade, repository, publisher) = Setup(Asset(MultimediaOwnership.Owned), referencesElsewhere: 0);

        await cascade.ApplyAsync(ProductUuid, [], CancellationToken.None);

        repository.FindManyCallCount.ShouldBe(0);
        publisher.Published.ShouldBeEmpty();
    }

    private sealed class FakeMultimediaRepository : IMultimediaRepository
    {
        public Dictionary<Guid, MultimediaAsset> Assets { get; } = [];

        public List<Guid> Removed { get; } = [];

        public int FindManyCallCount { get; private set; }

        public void Add(MultimediaAsset asset) => Assets[asset.Uuid] = asset;

        public Task<MultimediaAsset?> FindAsync(Guid uuid, CancellationToken cancellationToken)
            => Task.FromResult(Assets.GetValueOrDefault(uuid));

        public Task<List<MultimediaAsset>> FindManyAsync(
            IReadOnlyCollection<Guid> uuids,
            CancellationToken cancellationToken)
        {
            FindManyCallCount++;

            return Task.FromResult(uuids
                .Select(Assets.GetValueOrDefault)
                .Where(asset => asset is not null)
                .Select(asset => asset!)
                .ToList());
        }

        public void Remove(MultimediaAsset asset) => Removed.Add(asset.Uuid);
    }

    private sealed class FakePublisher : IIntegrationEventPublisher
    {
        public List<object> Published { get; } = [];

        public Task PublishAsync(object integrationEvent, CancellationToken cancellationToken = default)
        {
            Published.Add(integrationEvent);

            return Task.CompletedTask;
        }

        public Task PublishAllAsync(
            IEnumerable<object> integrationEvents,
            CancellationToken cancellationToken = default)
        {
            Published.AddRange(integrationEvents);

            return Task.CompletedTask;
        }

        public Task SaveChangesAndFlushAsync(CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }
}
