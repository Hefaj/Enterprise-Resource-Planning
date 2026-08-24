using System.Globalization;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.Options;
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
/// Rekordem, po którym artefakt się znajduje i autoryzuje, jest agregat przebiegu
/// (<c>ExportRun.ArtifactUuid</c>). Gdyby kiedyś pojawił się producent artefaktów bez własnego
/// agregatu, wtedy — i dopiero wtedy — potrzebna będzie tabela.</para>
/// </summary>
public sealed class MinioArtifactStore : IArtifactStore
{
    /// <summary>Nazwa pliku bywa niełacińska, a nagłówki HTTP są ASCII — stąd kodowanie procentowe.</summary>
    private const string FileNameMetadataKey = "x-amz-meta-erp-filename";

    private const string ExpireOnMetadataKey = "x-amz-meta-erp-expireon";

    private readonly IMinioClient _client;
    private readonly ErpArtifactOptions _options;

    public MinioArtifactStore(IMinioClient client, IOptions<ErpArtifactOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _client = client;
        _options = options.Value;
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
                        .WithBucket(_options.BucketName)
                        .WithObject(ObjectName(artifactUuid))
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
    public async Task<Stream> OpenAsync(Guid artifactUuid, CancellationToken cancellationToken)
    {
        // GetObjectAsync oddaje zawartość przez callback, a nie jako Stream, więc trzeba ją
        // gdzieś przełożyć. Plik tymczasowy z DeleteOnClose znika sam, gdy wołający zamknie
        // strumień — nie ma tu miejsca, w którym dałoby się posprzątać za niego.
        var stagingPath = Path.Combine(Path.GetTempPath(), $"erp-artifact-read-{Guid.CreateVersion7():N}.tmp");

        var target = new FileStream(
            stagingPath,
            FileMode.CreateNew,
            FileAccess.ReadWrite,
            FileShare.None,
            bufferSize: 81920,
            FileOptions.Asynchronous | FileOptions.DeleteOnClose);

        try
        {
            await _client.GetObjectAsync(
                new GetObjectArgs()
                    .WithBucket(_options.BucketName)
                    .WithObject(ObjectName(artifactUuid))
                    .WithCallbackStream(async (source, ct) =>
                        await source.CopyToAsync(target, ct).ConfigureAwait(false)),
                cancellationToken).ConfigureAwait(false);

            target.Position = 0;
            return target;
        }
        catch
        {
            await target.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<ArtifactMetadata?> GetMetadataAsync(Guid artifactUuid, CancellationToken cancellationToken)
    {
        try
        {
            var stat = await _client.StatObjectAsync(
                new StatObjectArgs()
                    .WithBucket(_options.BucketName)
                    .WithObject(ObjectName(artifactUuid)),
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

    /// <inheritdoc />
    public async Task<Uri> GetDownloadUrlAsync(Guid artifactUuid, TimeSpan ttl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var seconds = (int)Math.Clamp(ttl.TotalSeconds, 1, 7 * 24 * 3600);

        var url = await _client.PresignedGetObjectAsync(
            new PresignedGetObjectArgs()
                .WithBucket(_options.BucketName)
                .WithObject(ObjectName(artifactUuid))
                .WithExpiry(seconds)).ConfigureAwait(false);

        return new Uri(url);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid artifactUuid, CancellationToken cancellationToken)
    {
        try
        {
            await _client.RemoveObjectAsync(
                new RemoveObjectArgs()
                    .WithBucket(_options.BucketName)
                    .WithObject(ObjectName(artifactUuid)),
                cancellationToken).ConfigureAwait(false);
        }
        catch (ObjectNotFoundException)
        {
            // Usunięcie nieistniejącego artefaktu jest tym, o co wołającemu chodziło.
        }
    }

    private static string ObjectName(Guid artifactUuid) => artifactUuid.ToString("N");

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
