using System.Globalization;
using System.Runtime.CompilerServices;
using Erp.BuildingBlocks.Application.Abstractions;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace Erp.BuildingBlocks.Artifacts;

/// <summary>
/// <see cref="IArtifactStore"/> na MinIO (API zgodne z S3).
///
/// <para><b>Metadanych nie duplikujemy w Postgresie.</b> Nazwa pliku, typ MIME, rozmiar i moment
/// wygaśnięcia jadą jako metadane obiektu, bo magazyn i tak je przechowuje — osobna tabela byłaby
/// drugim źródłem prawdy, które trzeba trzymać w zgodzie przy każdym zapisie i usunięciu.
/// Rekordem, po którym artefakt się znajduje i autoryzuje, jest agregat modułu
/// (<c>ExportRun.ArtifactUuid</c>, <c>MultimediaAsset.ArtifactUuid</c>).</para>
///
/// <para><b>Dwa prefiksy.</b> <see cref="StagingPrefix"/> to poczekalnia dla plików wgrywanych
/// presigned <c>PUT</c>-em, <see cref="AssetPrefix"/> — miejsce dla zawartości potwierdzonej
/// komendą. Reguła lifecycle założona wyłącznie na poczekalni sprząta obiekty, których nikt
/// nigdy nie zarejestrował, i robi to bez ani jednej linijki kodu sprzątającego
/// (<c>docs/backend/media-storage.md</c> §4a).</para>
/// </summary>
public sealed class MinioArtifactStore : IArtifactStore
{
    /// <summary>Prefiks zawartości potwierdzonej — jedyny, po którym adresują wszystkie odczyty.</summary>
    public const string AssetPrefix = "assets/";

    /// <summary>Prefiks poczekalni; obowiązuje na nim reguła wygasania z <c>StagingRetentionDays</c>.</summary>
    public const string StagingPrefix = "staging/";

    /// <summary>Nazwa pliku bywa niełacińska, a nagłówki HTTP są ASCII — stąd kodowanie procentowe.</summary>
    private const string FileNameMetadataKey = "x-amz-meta-erp-filename";

    private const string ExpireOnMetadataKey = "x-amz-meta-erp-expireon";

    private readonly IMinioClient _client;
    private readonly string _bucketName;

    /// <summary>
    /// Kubełek jest parametrem instancji, a nie odczytem z opcji, bo moduł ma ich kilka
    /// o różnej retencji (patrz <see cref="ErpArtifactStoreOptions"/>) i to rejestracja
    /// w DI decyduje, który dostaje dany konsument.
    /// </summary>
    public MinioArtifactStore(IMinioClient client, ArtifactStoreProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);

        _client = client;
        _bucketName = profile.BucketName;
    }

    /// <inheritdoc />
    public async Task<Guid> WriteAsync(
        ArtifactDescriptor descriptor,
        Func<Stream, CancellationToken, Task> write,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(descriptor);
        ArgumentNullException.ThrowIfNull(write);

        var artifactUuid = Guid.CreateVersion7();

        // Producent pisze najpierw na dysk, a dopiero gotowy plik idzie do MinIO.
        //
        // Powód jest praktyczny: PutObject potrzebuje rozmiaru obiektu, a przy zapisie sterowanym
        // callbackiem nie znamy go, dopóki producent nie skończy. Bufor w pamięci załatwiłby to
        // samo kosztem trzymania całego eksportu na stercie — czyli dokładnie tego, czego ten
        // interfejs ma unikać. Plik tymczasowy kosztuje jeden przebieg po dysku i zdejmuje
        // ograniczenie na rozmiar artefaktu.
        var stagingPath = Path.Combine(Path.GetTempPath(), $"erp-artifact-{artifactUuid:N}.tmp");

        try
        {
            await using (var staging = new FileStream(
                stagingPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true))
            {
                await write(staging, cancellationToken).ConfigureAwait(false);
                await staging.FlushAsync(cancellationToken).ConfigureAwait(false);
            }

            var metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [FileNameMetadataKey] = Uri.EscapeDataString(descriptor.FileName),
            };

            if (descriptor.ExpireOn.HasValue)
            {
                metadata[ExpireOnMetadataKey] = descriptor.ExpireOn.Value.ToString("O", CultureInfo.InvariantCulture);
            }

            await using (var upload = new FileStream(
                stagingPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 81920,
                useAsync: true))
            {
                await _client.PutObjectAsync(
                    new PutObjectArgs()
                        .WithBucket(_bucketName)
                        .WithObject(AssetName(artifactUuid))
                        .WithStreamData(upload)
                        .WithObjectSize(upload.Length)
                        .WithContentType(descriptor.ContentType)
                        .WithHeaders(metadata),
                    cancellationToken).ConfigureAwait(false);
            }

            return artifactUuid;
        }
        finally
        {
            if (File.Exists(stagingPath))
            {
                File.Delete(stagingPath);
            }
        }
    }

    /// <inheritdoc />
    public async Task<ArtifactUploadTicket> CreateUploadTicketAsync(TimeSpan ttl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var artifactUuid = Guid.CreateVersion7();
        var seconds = ClampTtl(ttl);

        // Nagłówków NIE podpisujemy. Podpisany `Content-Type` musiałby przyjechać z przeglądarki
        // co do znaku, a ta dokłada do `PUT`-a własne nagłówki i potrafi doprecyzować typ pliku —
        // każda rozbieżność kończy się odrzuceniem podpisu przez magazyn. Typ i nazwa pliku
        // i tak nie są tu źródłem prawdy: opisuje je agregat, który powstaje po wgraniu.
        var url = await _client.PresignedPutObjectAsync(
            new PresignedPutObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(StagingName(artifactUuid))
                .WithExpiry(seconds)).ConfigureAwait(false);

        return new ArtifactUploadTicket(
            artifactUuid,
            new Uri(url),
            DateTimeOffset.UtcNow.AddSeconds(seconds));
    }

    /// <inheritdoc />
    public Task<ArtifactMetadata?> GetStagedMetadataAsync(Guid artifactUuid, CancellationToken cancellationToken)
        => StatAsync(artifactUuid, StagingName(artifactUuid), cancellationToken);

    /// <inheritdoc />
    public async Task PromoteAsync(Guid artifactUuid, CancellationToken cancellationToken)
    {
        var source = new CopySourceObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(StagingName(artifactUuid));

        // Kopia po stronie magazynu: bajty nie wracają do procesu .NET, a metadane obiektu
        // (typ MIME wgrany przez przeglądarkę) przechodzą razem z zawartością.
        await _client.CopyObjectAsync(
            new CopyObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(AssetName(artifactUuid))
                .WithCopyObjectSource(source),
            cancellationToken).ConfigureAwait(false);

        // Kolejność jest istotna: dopiero po udanej kopii. Odwrotna zostawiłaby okno, w którym
        // plik nie istnieje pod żadnym z dwóch prefiksów.
        await DeleteStagedAsync(artifactUuid, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task DeleteStagedAsync(Guid artifactUuid, CancellationToken cancellationToken)
        => RemoveAsync(StagingName(artifactUuid), cancellationToken);

    /// <inheritdoc />
    public async Task<bool> ReadToAsync(Guid artifactUuid, Stream target, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(target);

        try
        {
            await _client.GetObjectAsync(
                new GetObjectArgs()
                    .WithBucket(_bucketName)
                    .WithObject(AssetName(artifactUuid))
                    .WithCallbackStream(async (source, ct) =>
                        await source.CopyToAsync(target, ct).ConfigureAwait(false)),
                cancellationToken).ConfigureAwait(false);

            return true;
        }
        catch (ObjectNotFoundException)
        {
            return false;
        }
        catch (BucketNotFoundException)
        {
            return false;
        }
    }

    /// <inheritdoc />
    public Task<ArtifactMetadata?> GetMetadataAsync(Guid artifactUuid, CancellationToken cancellationToken)
        => StatAsync(artifactUuid, AssetName(artifactUuid), cancellationToken);

    /// <inheritdoc />
    public async IAsyncEnumerable<ArtifactListEntry> ListAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var items = _client.ListObjectsEnumAsync(
            new ListObjectsArgs()
                .WithBucket(_bucketName)
                .WithPrefix(AssetPrefix)
                .WithRecursive(true),
            cancellationToken);

        await foreach (var item in items.ConfigureAwait(false))
        {
            if (item.IsDir || !TryParseAssetKey(item.Key, out var uuid))
            {
                // Klucz spoza naszej konwencji nie jest artefaktem tego magazynu. Audytor ma
                // takie obiekty przemilczeć, a nie zgłaszać do skasowania — mogą być czyjeś.
                continue;
            }

            yield return new ArtifactListEntry(uuid, item.LastModifiedDateTime, (long)item.Size);
        }
    }

    /// <inheritdoc />
    public async Task<Uri> GetDownloadUrlAsync(Guid artifactUuid, TimeSpan ttl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var seconds = ClampTtl(ttl);

        var url = await _client.PresignedGetObjectAsync(
            new PresignedGetObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(AssetName(artifactUuid))
                .WithExpiry(seconds)).ConfigureAwait(false);

        return new Uri(url);
    }

    /// <inheritdoc />
    public Task DeleteAsync(Guid artifactUuid, CancellationToken cancellationToken)
        => RemoveAsync(AssetName(artifactUuid), cancellationToken);

    private async Task RemoveAsync(string objectName, CancellationToken cancellationToken)
    {
        try
        {
            await _client.RemoveObjectAsync(
                new RemoveObjectArgs()
                    .WithBucket(_bucketName)
                    .WithObject(objectName),
                cancellationToken).ConfigureAwait(false);
        }
        catch (ObjectNotFoundException)
        {
            // Usunięcie nieistniejącego artefaktu jest tym, o co wołającemu chodziło.
        }
    }

    private async Task<ArtifactMetadata?> StatAsync(
        Guid artifactUuid,
        string objectName,
        CancellationToken cancellationToken)
    {
        try
        {
            var stat = await _client.StatObjectAsync(
                new StatObjectArgs()
                    .WithBucket(_bucketName)
                    .WithObject(objectName),
                cancellationToken).ConfigureAwait(false);

            return new ArtifactMetadata(
                artifactUuid,
                ReadFileName(stat.MetaData, artifactUuid),
                stat.ContentType ?? "application/octet-stream",
                stat.Size,
                ReadExpireOn(stat.MetaData));
        }
        catch (ObjectNotFoundException)
        {
            return null;
        }
        catch (BucketNotFoundException)
        {
            return null;
        }
    }

    private static string AssetName(Guid artifactUuid) => AssetPrefix + artifactUuid.ToString("N");

    private static string StagingName(Guid artifactUuid) => StagingPrefix + artifactUuid.ToString("N");

    private static bool TryParseAssetKey(string? key, out Guid artifactUuid)
    {
        artifactUuid = Guid.Empty;

        return key is not null
            && key.StartsWith(AssetPrefix, StringComparison.Ordinal)
            && Guid.TryParseExact(key[AssetPrefix.Length..], "N", out artifactUuid);
    }

    /// <summary>Górna granica to twardy limit S3 na ważność podpisu — siedem dni.</summary>
    private static int ClampTtl(TimeSpan ttl) => (int)Math.Clamp(ttl.TotalSeconds, 1, 7 * 24 * 3600);

    private static string ReadFileName(IDictionary<string, string>? metadata, Guid artifactUuid)
    {
        var raw = Lookup(metadata, FileNameMetadataKey);
        return raw is null ? $"{artifactUuid:N}.bin" : Uri.UnescapeDataString(raw);
    }

    private static DateTimeOffset? ReadExpireOn(IDictionary<string, string>? metadata)
    {
        var raw = Lookup(metadata, ExpireOnMetadataKey);

        return DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed)
            ? parsed
            : null;
    }

    /// <summary>
    /// S3 oddaje metadane bez prefiksu <c>x-amz-meta-</c> i z nieprzewidywalną wielkością liter,
    /// a bywa, że z prefiksem — sprawdzamy oba warianty zamiast zgadywać.
    /// </summary>
    private static string? Lookup(IDictionary<string, string>? metadata, string headerKey)
    {
        if (metadata is null)
        {
            return null;
        }

        var shortKey = headerKey.Replace("x-amz-meta-", string.Empty, StringComparison.OrdinalIgnoreCase);

        foreach (var (key, value) in metadata)
        {
            if (key.Equals(headerKey, StringComparison.OrdinalIgnoreCase)
                || key.Equals(shortKey, StringComparison.OrdinalIgnoreCase))
            {
                return value;
            }
        }

        return null;
    }
}
