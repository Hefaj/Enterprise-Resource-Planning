using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Zakłada wpis katalogowy dla pliku wgranego prosto do magazynu.
///
/// <para><b>Odczyt metadanych z magazynu jest tu walidacją, a nie uzupełnianiem danych.</b>
/// Bilet wgrywania jest bearer-owy i wydany z góry, więc do tego miejsca może dojść żądanie
/// wskazujące artefakt, którego nikt nie wgrał — bo transfer padł, bo użytkownik go przerwał,
/// albo bo ktoś zgadł identyfikator. Brak obiektu w magazynie oznacza odmowę: wpis w katalogu
/// wskazujący na pustkę byłby w UI zepsutą miniaturką bez żadnego wyjaśnienia.</para>
///
/// <para>Rozmiar i typ MIME biorą się z tego samego odczytu, zamiast z deklaracji klienta —
/// patrz <see cref="MultimediaAsset.CreateUploaded"/>.</para>
/// </summary>
public sealed class MultimediaCreateCommandHandler : CommandHandler<MultimediaCreateCommand, Guid>
{
    private readonly IMultimediaRepository _repository;
    private readonly IArtifactStore _artifacts;
    private readonly IClock _clock;

    public MultimediaCreateCommandHandler(
        IMultimediaRepository repository,
        // Magazyn trwały, nie domyślny: w domyślnym obowiązuje reguła wygasania, która skasowałaby
        // zdjęcia produktów po kilku dniach (patrz ErpArtifactOptions.MediaBucketName).
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts,
        IClock clock)
    {
        _repository = repository;
        _artifacts = artifacts;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(MultimediaCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var metadata = await _artifacts.GetMetadataAsync(command.ArtifactUuid, ct).ConfigureAwait(false)
            ?? throw new DomainException(
                "multimedia_artifact_not_uploaded",
                "Plik nie dotarł do magazynu — wgraj go ponownie.");

        var asset = MultimediaAsset.CreateUploaded(
            command.Uuid,
            command.ArtifactUuid,
            command.FileName,
            metadata.ContentType,
            metadata.SizeBytes,
            command.SortOrder,
            _clock.UtcNow);

        _repository.Add(asset);

        return asset.Uuid;
    }
}
