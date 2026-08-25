using System.Globalization;
using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Microsoft.Extensions.Options;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Wypuszcza <c>ArtifactDerivativesRequested</c> dla istniejącego zasobu.
///
/// <para><b>Handler niczego nie generuje ani nie zmienia w bazie.</b> Cała praca — odczyt
/// oryginału, skalowanie, zapis wariantów, oznaczenie rekordu — dzieje się w konsumencie
/// (<c>ArtifactDerivativesRequestedHandler</c>),
/// dokładnie tak samo jak przy rejestracji pliku. Powielanie tej ścieżki synchronicznie
/// wciągnęłoby skalowanie obrazów do transakcji operacji masowej: chunk stu zdjęć trzymałby
/// wtedy transakcję przez kilkadziesiąt sekund pracy procesora.</para>
///
/// <para><b>Zadanie kończy się sukcesem, gdy zlecenie zostało przyjęte</b>, a nie gdy
/// miniaturka jest gotowa. To jest ta sama granica, co przy wgrywaniu, i trzeba ją znać
/// czytając raport zadania: plik, którego Skia nie zdekoduje, zostawia tu <c>succeeded</c>
/// i ląduje wyłącznie w logu konsumenta (<c>docs/backend/endpoint-naming.md</c> §5 —
/// <c>Exec</c> bez zmiany encji nie wygeneruje nawet <c>AggregateChanged</c>; to zdarzenie
/// przyjdzie dopiero z konsumenta, gdy warianty faktycznie powstaną).</para>
///
/// <para>Odmowy są dwie i obie dotyczą pojedynczego elementu paczki, nie całej operacji:
/// zasób bez własnego pliku albo nie-obraz (<c>multimedia_derivatives_unsupported</c>)
/// i oryginał zbyt duży, żeby bezpiecznie go zdekodować
/// (<c>multimedia_derivative_source_too_large</c>) — ten sam próg, co przy rejestracji.</para>
/// </summary>
public sealed class MultimediaExecGenerateDerivativesCommandHandler
    : CommandHandler<MultimediaExecGenerateDerivativesCommand, Guid>
{
    private readonly IMultimediaRepository _repository;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly MultimediaOptions _options;

    public MultimediaExecGenerateDerivativesCommandHandler(
        IMultimediaRepository repository,
        IIntegrationEventPublisher publisher,
        IOptions<MultimediaOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _repository = repository;
        _publisher = publisher;
        _options = options.Value;
    }

    public override async Task<Guid> ExecuteAsync(
        MultimediaExecGenerateDerivativesCommand command,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var asset = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(MultimediaAsset), command.Uuid);

        if (!asset.SupportsDerivatives)
        {
            throw new DomainException(
                "multimedia_derivatives_unsupported",
                "Warianty pochodne powstają wyłącznie dla obrazów trzymanych w naszym magazynie.");
        }

        if (asset.FileSize > _options.MaxDerivativeSourceBytes)
        {
            throw new DomainException(
                "multimedia_derivative_source_too_large",
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"Oryginał ma {asset.FileSize / 1024 / 1024} MB i przekracza próg "
                    + $"{_options.MaxDerivativeSourceBytes / 1024 / 1024} MB dla generowania wariantów."));
        }

        await _publisher.PublishAsync(
            new ArtifactDerivativesRequested(
                CatalogModule.Name,
                ArtifactStoreKeys.Media,
                asset.ArtifactUuid!.Value,
                asset.Uuid),
            ct).ConfigureAwait(false);

        return asset.Uuid;
    }
}
