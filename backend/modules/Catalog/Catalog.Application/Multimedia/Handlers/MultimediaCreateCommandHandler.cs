using System.Globalization;
using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Zakłada wpis katalogowy dla pliku wgranego prosto do magazynu i przenosi go z poczekalni
/// do zawartości potwierdzonej.
///
/// <para><b>Odczyt metadanych z magazynu jest tu walidacją, a nie uzupełnianiem danych.</b>
/// Bilet wgrywania jest bearer-owy i wydany z góry, więc do tego miejsca może dojść żądanie
/// wskazujące artefakt, którego nikt nie wgrał — bo transfer padł, bo użytkownik go przerwał,
/// albo bo ktoś zgadł identyfikator. Brak obiektu w poczekalni oznacza odmowę: wpis w katalogu
/// wskazujący na pustkę byłby w UI zepsutą miniaturką bez żadnego wyjaśnienia.</para>
///
/// <para>Rozmiar i typ MIME biorą się z tego samego odczytu, zamiast z deklaracji klienta —
/// patrz <see cref="MultimediaAsset.CreateUploaded"/>.</para>
///
/// <para><b>Promocja idzie PRZED zatwierdzeniem transakcji</b>, choć transakcji nie zna.
/// Odwrotna kolejność (najpierw zapis, potem przeniesienie pliku) zostawiałaby przy awarii
/// wiersz wskazujący na poczekalnię, którą reguła lifecycle sprząta po dobie — czyli zepsutą
/// miniaturkę u użytkownika. Ta kolejność zostawia w najgorszym razie obiekt bez wiersza:
/// niewidoczny dla nikogo i wyłapywany przez audytora rozjazdu
/// (<c>docs/guides/backend/media-storage.md</c> §4d).</para>
/// </summary>
public sealed class MultimediaCreateCommandHandler : CommandHandler<MultimediaCreateCommand, Guid>
{
    private readonly IMultimediaRepository _repository;
    private readonly IArtifactStore _artifacts;
    private readonly IClock _clock;
    private readonly MultimediaOptions _options;
    private readonly IIntegrationEventPublisher _publisher;

    public MultimediaCreateCommandHandler(
        IMultimediaRepository repository,
        // Magazyn trwały, nie domyślny: w domyślnym obowiązuje reguła wygasania, która skasowałaby
        // zdjęcia produktów po kilku dniach (patrz ErpArtifactStoreOptions.RetentionDays).
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts,
        IClock clock,
        IOptions<MultimediaOptions> options,
        IIntegrationEventPublisher publisher)
    {
        ArgumentNullException.ThrowIfNull(options);

        _repository = repository;
        _artifacts = artifacts;
        _clock = clock;
        _options = options.Value;
        _publisher = publisher;
    }

    public override async Task<Guid> ExecuteAsync(MultimediaCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var metadata = await _artifacts.GetStagedMetadataAsync(command.ArtifactUuid, ct).ConfigureAwait(false)
            ?? throw new DomainException(
                "multimedia_artifact_not_uploaded",
                "Plik nie dotarł do magazynu — wgraj go ponownie.");

        if (metadata.SizeBytes > _options.MaxFileSizeBytes)
        {
            // Plik już leży w poczekalni — reguła lifecycle usunęłaby go po dobie, ale nie ma
            // powodu trzymać przez ten czas czegoś, co właśnie zostało odrzucone.
            await _artifacts.DeleteStagedAsync(command.ArtifactUuid, ct).ConfigureAwait(false);

            throw new DomainException(
                "multimedia_file_too_large",
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"Plik ma {metadata.SizeBytes / 1024 / 1024} MB i przekracza limit "
                    + $"{_options.MaxFileSizeBytes / 1024 / 1024} MB."));
        }

        var asset = MultimediaAsset.CreateUploaded(
            command.Uuid,
            command.ArtifactUuid,
            command.FileName,
            metadata.ContentType,
            metadata.SizeBytes,
            command.SortOrder,
            _clock.UtcNow);

        _repository.Add(asset);

        await _artifacts.PromoteAsync(command.ArtifactUuid, ct).ConfigureAwait(false);

        // Warianty pochodne powstają PO zatwierdzeniu transakcji, przez outbox. Skalowanie
        // obrazu 4K to setki milisekund procesora — wykonane tutaj przedłużyłoby o tyle
        // wgranie każdej paczki zdjęć, czyli moment, w którym użytkownik czeka przy modalu.
        //
        // Plik zbyt duży, żeby bezpiecznie go zdekodować, nie dostaje zlecenia w ogóle:
        // rozpakowana bitmapa jest wielokrotnie większa niż plik, więc próba i tak skończyłaby
        // się wyjątkiem — tyle że dopiero w konsumencie i po ponowieniach.
        if (asset.SupportsDerivatives && metadata.SizeBytes <= _options.MaxDerivativeSourceBytes)
        {
            await _publisher.PublishAsync(
                new ArtifactDerivativesRequested(
                    CatalogModule.Name,
                    ArtifactStoreKeys.Media,
                    command.ArtifactUuid,
                    asset.Uuid),
                ct).ConfigureAwait(false);
        }

        return asset.Uuid;
    }
}
