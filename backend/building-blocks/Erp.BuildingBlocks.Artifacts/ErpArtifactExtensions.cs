using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.ILM;

namespace Erp.BuildingBlocks.Artifacts;

/// <summary>Rejestracja magazynu artefaktów w module.</summary>
public static class ErpArtifactExtensions
{
    /// <summary>
    /// Podpina <see cref="IArtifactStore"/> na MinIO plus jednorazowe założenie kubełka przy starcie.
    ///
    /// <para>Rejestracja jest jawna, a nie przez skan zestawów (<c>AddErpModule</c>), bo niesie
    /// decyzję: klient MinIO jest singletonem trzymającym pulę połączeń HTTP, a inicjalizator
    /// kubełka to hosted service. Konwencja <c>I{Nazwa}</c> → <c>{Nazwa}</c> nie zna ani jednego,
    /// ani drugiego cyklu życia.</para>
    /// </summary>
    public static IServiceCollection AddErpArtifacts(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<ErpArtifactOptions>(configuration.GetSection(ErpArtifactOptions.SectionName));

        services.AddSingleton<IMinioClient>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<ErpArtifactOptions>>().Value;

            return new MinioClient()
                .WithEndpoint(options.Endpoint)
                .WithCredentials(options.AccessKey, options.SecretKey)
                .WithSSL(options.UseSsl)
                .Build();
        });

        services.AddSingleton<IArtifactStore, MinioArtifactStore>();
        services.AddHostedService<ArtifactBucketInitializer>();

        return services;
    }
}

/// <summary>
/// Zakłada kubełek przy starcie modułu, idempotentnie.
///
/// <para>Świadomie w kodzie, a nie w <c>docker-compose.yml</c> ani w instrukcji dla developera:
/// kubełek jest częścią kontraktu modułu z magazynem, więc moduł ma go zapewnić sam. Krok ręczny
/// prędzej czy później zostaje pominięty na czyjejś maszynie, a objawia się dopiero przy pierwszym
/// eksporcie, komunikatem o nieistniejącym kubełku.</para>
///
/// <para>Brak MinIO przy starcie <b>nie przewraca hosta</b> — moduł działa dalej, a eksport padnie
/// dopiero przy próbie zapisu. Magazyn artefaktów nie jest zależnością krytyczną dla reszty API
/// i nie ma powodu, żeby jego niedostępność blokowała odczyty produktów.</para>
/// </summary>
internal sealed partial class ArtifactBucketInitializer : IHostedService
{
    private readonly IMinioClient _client;
    private readonly ErpArtifactOptions _options;
    private readonly ILogger<ArtifactBucketInitializer> _logger;

    public ArtifactBucketInitializer(
        IMinioClient client,
        IOptions<ErpArtifactOptions> options,
        ILogger<ArtifactBucketInitializer> logger)
    {
        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var exists = await _client
                .BucketExistsAsync(
                    new Minio.DataModel.Args.BucketExistsArgs().WithBucket(_options.BucketName),
                    cancellationToken)
                .ConfigureAwait(false);

            if (!exists)
            {
                await _client
                    .MakeBucketAsync(
                        new Minio.DataModel.Args.MakeBucketArgs().WithBucket(_options.BucketName),
                        cancellationToken)
                    .ConfigureAwait(false);

                LogBucketCreated(_logger, _options.BucketName);
            }

            await ApplyLifecycleAsync(cancellationToken).ConfigureAwait(false);
        }
#pragma warning disable CA1031 // Niedostępny magazyn artefaktów nie może przewrócić startu modułu.
        catch (Exception ex)
#pragma warning restore CA1031
        {
            LogBucketSetupFailed(_logger, _options.BucketName, _options.Endpoint, ex);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Ustawia regułę wygasania obiektów spójną z <see cref="ErpArtifactOptions.RetentionDays"/>.
    ///
    /// <para>Reguła w magazynie jest <b>sprzątaczką, nie źródłem prawdy</b> — o tym, czy artefakt
    /// wolno jeszcze pobrać, decyduje <c>job.expire_on</c> sprawdzane przez endpoint. Gdyby to
    /// magazyn rozstrzygał, użytkownik zamiast czytelnej odmowy dostawałby 404 z presigned URL-a,
    /// czyli błąd wyglądający na awarię.</para>
    ///
    /// <para>Ustawiana przy każdym starcie, bo zmiana <c>RetentionDays</c> w konfiguracji ma
    /// dotrzeć do kubełka bez ręcznego kroku — dokładnie tak jak samo założenie kubełka.</para>
    /// </summary>
    private async Task ApplyLifecycleAsync(CancellationToken cancellationToken)
    {
        var configuration = new LifecycleConfiguration(
        [
            new LifecycleRule(
                abortIncompleteMultipartUpload: null,
                id: "erp-artifact-retention",
                expiration: new Expiration { Days = _options.RetentionDays },
                transition: null,
                // Pusty prefiks = cały kubełek. Kubełek jest dedykowany artefaktom jednego
                // modułu (patrz ErpArtifactOptions.BucketName), więc nie ma czego wyłączać.
                filter: new RuleFilter(null, string.Empty, null),
                noncurrentVersionExpiration: null,
                noncurrentVersionTransition: null,
                status: LifecycleRule.LifecycleRuleStatusEnabled),
        ]);

        await _client
            .SetBucketLifecycleAsync(
                new Minio.DataModel.Args.SetBucketLifecycleArgs()
                    .WithBucket(_options.BucketName)
                    .WithLifecycleConfiguration(configuration),
                cancellationToken)
            .ConfigureAwait(false);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Założono kubełek artefaktów {Bucket}.")]
    private static partial void LogBucketCreated(ILogger logger, string bucket);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Nie udało się przygotować kubełka {Bucket} pod adresem {Endpoint}. "
            + "Eksporty będą kończyć się błędem do czasu naprawy.")]
    private static partial void LogBucketSetupFailed(
        ILogger logger,
        string bucket,
        string endpoint,
        Exception exception);
}
