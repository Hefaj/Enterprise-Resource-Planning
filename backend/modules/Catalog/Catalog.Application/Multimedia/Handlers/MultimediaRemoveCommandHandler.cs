using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Usuwa zasób z katalogu i zleca skasowanie jego pliku w magazynie.
///
/// <para><b>Dlaczego plik nie znika tutaj, wywołaniem magazynu.</b> Baza i MinIO nie są w jednej
/// transakcji. Kasowanie wprost z handlera daje dwie awarie, obie ciche: przy rollbacku zostaje
/// wiersz wskazujący na nieistniejący plik, a przy padnięciu magazynu — plik, o którym nikt już
/// nie wie. Koperta wypuszczona przez outbox zapisuje się w <b>tej samej transakcji</b>, co
/// usunięcie wiersza, i doczeka się ponowienia po restarcie
/// (<c>docs/backend/media-storage.md</c> §4b).</para>
///
/// <para><b>Liczbę referencji podaje handler, a decyzję podejmuje agregat.</b> Agregat nie
/// sięga do bazy — tak samo jak przy wykrywaniu cykli w rolach Identity. Handler wykonuje
/// zapytanie, agregat rozstrzyga regułę.</para>
///
/// <para>W trybie masowym odmowa dotyczy pojedynczego elementu: <c>job_item</c> kończy się
/// błędem <c>multimedia_still_referenced</c>, a reszta paczki przechodzi. To jest sukces
/// częściowy, o który chodzi w <c>bulk-commands.md</c>.</para>
/// </summary>
public sealed class MultimediaRemoveCommandHandler : CommandHandler<MultimediaRemoveCommand, Guid>
{
    private readonly IMultimediaRepository _repository;
    private readonly IMultimediaQueries _queries;
    private readonly IIntegrationEventPublisher _publisher;

    public MultimediaRemoveCommandHandler(
        IMultimediaRepository repository,
        IMultimediaQueries queries,
        IIntegrationEventPublisher publisher)
    {
        _repository = repository;
        _queries = queries;
        _publisher = publisher;
    }

    public override async Task<Guid> ExecuteAsync(MultimediaRemoveCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var asset = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(MultimediaAsset), command.Uuid);

        var references = await _queries.CountReferencesAsync([command.Uuid], ct).ConfigureAwait(false);

        asset.EnsureCanRemove(references.GetValueOrDefault(command.Uuid));

        _repository.Remove(asset);

        // Zasób wskazany adresem zewnętrznym nie ma naszego pliku do skasowania — bajty leżą
        // poza systemem i nie należą do nas.
        if (asset.ArtifactUuid is { } artifactUuid)
        {
            await _publisher.PublishAsync(
                new ArtifactDeletionRequested(CatalogModule.Name, ArtifactStoreKeys.Media, artifactUuid),
                ct).ConfigureAwait(false);
        }

        return asset.Uuid;
    }
}
