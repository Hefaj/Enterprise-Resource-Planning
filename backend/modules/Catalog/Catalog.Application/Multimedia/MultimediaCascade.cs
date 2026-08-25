using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;

namespace Catalog.Application.Multimedia;

/// <inheritdoc cref="IMultimediaCascade"/>
public sealed class MultimediaCascade : IMultimediaCascade
{
    private readonly IMultimediaRepository _repository;
    private readonly IMultimediaQueries _queries;
    private readonly IIntegrationEventPublisher _publisher;

    public MultimediaCascade(
        IMultimediaRepository repository,
        IMultimediaQueries queries,
        IIntegrationEventPublisher publisher)
    {
        _repository = repository;
        _queries = queries;
        _publisher = publisher;
    }

    /// <inheritdoc />
    public async Task ApplyAsync(
        Guid productUuid,
        IReadOnlyCollection<Guid> detachedMultimediaUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(detachedMultimediaUuids);

        if (detachedMultimediaUuids.Count == 0)
        {
            return;
        }

        // Licznik jedzie z bazy, gdzie odpięte przed chwilą wiersze JESZCZE SĄ — transakcja nie
        // jest zatwierdzona. Dlatego pytamy o referencje z pominięciem tego produktu: to jest
        // dokładnie stan po zapisie, bez zgadywania i bez zaglądania w ChangeTracker z warstwy,
        // która o EF nie wie.
        var references = await _queries
            .CountReferencesExceptAsync(detachedMultimediaUuids, productUuid, cancellationToken)
            .ConfigureAwait(false);

        var orphaned = detachedMultimediaUuids
            .Where(uuid => references.GetValueOrDefault(uuid) == 0)
            .ToList();

        if (orphaned.Count == 0)
        {
            return;
        }

        var assets = await _repository.FindManyAsync(orphaned, cancellationToken).ConfigureAwait(false);

        foreach (var asset in assets)
        {
            // Pozycja biblioteki zostaje. „Nikt jej teraz nie używa" nie jest powodem do
            // skasowania — dokładnie ten wariant projekt odrzucił.
            if (asset.Ownership != MultimediaOwnership.Owned)
            {
                continue;
            }

            _repository.Remove(asset);

            // Plik w magazynie kasuje się przez outbox, tak samo jak przy jawnym usunięciu
            // zasobu: koperta zapisuje się w tej samej transakcji, co usunięcie wiersza
            // (media-storage.md §4b). Zasób wskazany adresem zewnętrznym nie ma naszego pliku.
            if (asset.ArtifactUuid is { } artifactUuid)
            {
                await _publisher.PublishAsync(
                    new ArtifactDeletionRequested(CatalogModule.Name, ArtifactStoreKeys.Media, artifactUuid),
                    cancellationToken).ConfigureAwait(false);
            }
        }
    }
}
