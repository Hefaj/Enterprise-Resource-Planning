using Catalog.Application;
using Catalog.Application.Abstractions;
using Catalog.Application.Multimedia;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Catalog.Infrastructure.Consumers;

/// <summary>
/// Generuje warianty pochodne obrazu (miniaturka, podgląd) i oznacza rekord, gdy są gotowe.
///
/// <para><b>Dlaczego to jest konsument, a nie krok komendy.</b> Skalowanie obrazu 4K to setki
/// milisekund pracy procesora. Wykonane w komendzie rejestrującej przedłużyłoby o tyle wgranie
/// każdej paczki zdjęć — czyli moment, w którym użytkownik patrzy na modal i czeka. Tu dzieje
/// się to po zatwierdzeniu transakcji, a UI przez tych kilka sekund pokazuje ikonę zastępczą
/// (<c>docs/backend/media-storage.md</c> §9).</para>
///
/// <para><b>Idempotencja.</b> Dostarczenie jest <i>at-least-once</i>, więc handler musi znieść
/// powtórzenie. Znosi: warianty zapisują się pod deterministycznym kluczem, a powtórka nadpisuje
/// ten sam plik tą samą zawartością. Oznaczenie rekordu też jest idempotentne.</para>
///
/// <para><b>Plik, którego nie da się zdekodować, nie jest awarią.</b> Rozszerzenie i typ MIME
/// bierzemy od przeglądarki, więc „obrazem" bywa plik uszkodzony albo w formacie, którego Skia
/// nie zna. Takie zlecenie kończy się wpisem w logu i niczym więcej — ponawianie go w nieskończoność
/// zapchałoby kolejkę, a rekord po prostu zostaje bez wariantów i dostaje w UI ikonę typu.</para>
/// </summary>
public static partial class ArtifactDerivativesRequestedHandler
{
    public static async Task HandleAsync(
        ArtifactDerivativesRequested message,
        IServiceProvider services,
        CatalogDbContext dbContext,
        IUnitOfWork unitOfWork,
        IImageDerivativeGenerator generator,
        IClock clock,
        IOptions<MultimediaOptions> options,
        ILogger<CatalogDbContext> logger,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(options);

        if (!string.Equals(message.Module, CatalogModule.Name, StringComparison.Ordinal))
        {
            return;
        }

        var settings = options.Value;
        var store = services.GetRequiredKeyedService<IArtifactStore>(message.StoreKey);

        using var original = new MemoryStream();

        if (!await store.ReadToAsync(message.ArtifactUuid, original, cancellationToken).ConfigureAwait(false))
        {
            // Oryginału nie ma — zasób zdążył zniknąć między zapisem a dostarczeniem koperty.
            // Nie ma czego generować i nie ma o co się awanturować.
            LogSourceMissing(logger, message.ArtifactUuid);
            return;
        }

        var source = original.GetBuffer().AsMemory(0, (int)original.Length);

        var variants = new (string Name, int MaxEdge)[]
        {
            (MultimediaVariants.Thumb, settings.ThumbnailMaxEdge),
            (MultimediaVariants.Preview, settings.PreviewMaxEdge),
        };

        var written = 0;

        foreach (var (name, maxEdge) in variants)
        {
            var derivative = generator.Create(source, maxEdge, settings.DerivativeQuality);

            if (derivative is null)
            {
                LogUndecodable(logger, message.ArtifactUuid, name);
                continue;
            }

            using var content = new MemoryStream(derivative.Content, writable: false);

            await store.WriteVariantAsync(message.ArtifactUuid, name, content, derivative.ContentType, cancellationToken)
                .ConfigureAwait(false);

            written++;
        }

        if (written == 0)
        {
            return;
        }

        var asset = await dbContext.MultimediaAssets
            .FirstOrDefaultAsync(m => m.Uuid == message.OwnerUuid, cancellationToken)
            .ConfigureAwait(false);

        if (asset is null)
        {
            return;
        }

        asset.MarkDerivativesGenerated(clock.UtcNow);

        // Przez IUnitOfWork, nie przez samo SaveChanges: skan ChangeTrackera wypuszcza wtedy
        // `AggregateChanged` dla `catalog.multimedia`, więc otwarta galeria odświeża się sama
        // i sięga po miniaturkę zamiast po oryginał — bez odpytywania w pętli.
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Pominięto generowanie wariantów: artefaktu {ArtifactUuid} nie ma już w magazynie.")]
    private static partial void LogSourceMissing(ILogger logger, Guid artifactUuid);

    [LoggerMessage(EventId = 2, Level = LogLevel.Warning,
        Message = "Nie udało się zdekodować artefaktu {ArtifactUuid} do wariantu {Variant}. "
            + "Zasób zostanie bez miniaturki i dostanie w UI ikonę typu pliku.")]
    private static partial void LogUndecodable(ILogger logger, Guid artifactUuid, string variant);
}
