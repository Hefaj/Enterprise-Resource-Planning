using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.ILM;
using Minio.Exceptions;
using System.Net.Sockets;

namespace Erp.BuildingBlocks.Artifacts;

/// <summary>
/// Kubełek, na którym pracuje dana instancja <see cref="MinioArtifactStore"/>.
///
/// <para>Osobny typ zamiast gołego stringa, bo to jedyny parametr odróżniający rejestracje
/// tego samego magazynu, a pomyłka między nimi kasuje dane po tygodniu
/// (patrz <see cref="ErpArtifactStoreOptions.RetentionDays"/>).</para>
/// </summary>
/// <param name="BucketName">Nazwa kubełka w magazynie.</param>
public sealed record ArtifactStoreProfile(string BucketName);

/// <summary>Rejestracja magazynów artefaktów w module.</summary>
public static class ErpArtifactExtensions
{
    /// <summary>
    /// Podpina <see cref="IArtifactStore"/> na MinIO — po jednej rejestracji na wpis w sekcji
    /// <c>Artifacts:Stores</c> — plus jednorazowe założenie kubełków przy starcie.
    ///
    /// <para>Rejestracja jest jawna, a nie przez skan zestawów (<c>AddErpModule</c>), bo niesie
    /// decyzję: klient MinIO jest singletonem trzymającym pulę połączeń HTTP, a inicjalizator
    /// kubełków to hosted service. Konwencja <c>I{Nazwa}</c> → <c>{Nazwa}</c> nie zna ani jednego,
    /// ani drugiego cyklu życia.</para>
    /// </summary>
    public static IServiceCollection AddErpArtifacts(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<ErpArtifactOptions>(configuration.GetSection(ErpArtifactOptions.SectionName));

        // Walidacja przy starcie, a nie przy pierwszym zapisie: dwa magazyny wskazujące ten sam
        // kubełek to reguła wygasania założona na cudzą zawartość, a objaw pojawia się dopiero
        // po upływie retencji — wtedy, gdy pliki już nie istnieją.
        services.AddOptions<ErpArtifactOptions>().Validate(
            static options => Validate(options) is null,
            "Nieprawidłowa sekcja `Artifacts` — patrz log startowy.");

        services.AddSingleton<IMinioClient>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<ErpArtifactOptions>>().Value;
            var error = Validate(options);

            if (error is not null)
            {
                throw new InvalidOperationException(error);
            }

            return new MinioClient()
                .WithEndpoint(options.Endpoint)
                .WithCredentials(options.AccessKey, options.SecretKey)
                .WithSSL(options.UseSsl)
                .Build();
        });

        // Magazyn wygasający jest rejestracją DOMYŚLNĄ (bezkluczową), bo taki jest każdy plik
        // produkowany przez system. Zawartość trwała musi poprosić o siebie jawnie, przez klucz —
        // odwrotny domyślny kończyłby się cichym wydłużeniem życia eksportów zamiast błędem.
        services.AddSingleton<IArtifactStore>(sp => CreateStore(sp, ArtifactStoreKeys.Transient));

        services.AddKeyedSingleton<IArtifactStore>(
            ArtifactStoreKeys.Transient,
            (sp, _) => CreateStore(sp, ArtifactStoreKeys.Transient));

        services.AddKeyedSingleton<IArtifactStore>(
            ArtifactStoreKeys.Media,
            (sp, _) => CreateStore(sp, ArtifactStoreKeys.Media));

        // Wybór magazynu po kluczu przyjeżdżającym w kopercie komunikatu — patrz
        // IArtifactStoreResolver. Rejestracja jawna, bo skan `AddErpModule` nie zna tego
        // cyklu życia (singleton) i nie sięga do zestawów building blocks.
        services.AddSingleton<IArtifactStoreResolver, KeyedArtifactStoreResolver>();

        services.AddHostedService<ArtifactBucketInitializer>();

        return services;
    }

    private static MinioArtifactStore CreateStore(IServiceProvider sp, string storeKey)
    {
        var options = sp.GetRequiredService<IOptions<ErpArtifactOptions>>().Value;

        return new MinioArtifactStore(
            sp.GetRequiredService<IMinioClient>(),
            new ArtifactStoreProfile(options.RequireStore(storeKey).BucketName));
    }

    /// <summary>Komunikat błędu albo <c>null</c>, gdy konfiguracja jest spójna.</summary>
    private static string? Validate(ErpArtifactOptions options)
    {
        if (options.Stores.Count == 0)
        {
            return "Sekcja `Artifacts:Stores` jest pusta — moduł nie ma gdzie zapisywać plików.";
        }

        foreach (var (key, store) in options.Stores)
        {
            if (string.IsNullOrWhiteSpace(store.BucketName))
            {
                return $"Magazyn `{key}` nie ma nazwy kubełka (`Artifacts:Stores:{key}:BucketName`).";
            }
        }

        var duplicate = options.Stores
            .GroupBy(s => s.Value.BucketName, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate is not null)
        {
            return $"Magazyny {string.Join(", ", duplicate.Select(d => $"`{d.Key}`"))} wskazują ten sam "
                + $"kubełek `{duplicate.Key}`. Reguła wygasania jest własnością kubełka, więc retencja "
                + "jednego magazynu skasowałaby zawartość drugiego — bez błędu i bez wpisu w logu.";
        }

        if (options.Stores.TryGetValue(ArtifactStoreKeys.Media, out var media) && media.RetentionDays.HasValue)
        {
            return "Magazyn `media` ma ustawione `RetentionDays`. To zawartość trwała — żyje tak długo, "
                + "jak agregat, który ją opisuje. Reguła wygasania skasowałaby zdjęcia i załączniki "
                + "użytkowników, a objawiłoby się to dopiero pustymi miniaturkami po retencji.";
        }

        return null;
    }
}

/// <summary>
/// Zakłada kubełki modułu przy starcie, idempotentnie, i uzgadnia ich reguły wygasania.
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
    /// <summary>Reguła obejmująca cały kubełek — tylko dla magazynów z ustawioną retencją.</summary>
    private const string RetentionRuleId = "erp-artifact-retention";

    /// <summary>
    /// Reguła obejmująca wyłącznie poczekalnię. Jest w KAŻDYM kubełku, również wygasającym:
    /// prefiks postojowy istnieje wszędzie, gdzie da się wydać bilet wgrywania.
    /// </summary>
    private const string StagingRuleId = "erp-staging-cleanup";

    private readonly IMinioClient _client;
    private readonly ErpArtifactOptions _options;
    private readonly ILogger<ArtifactBucketInitializer> _logger;

    public ArtifactBucketInitializer(
        IMinioClient client,
        IOptions<ErpArtifactOptions> options,
        ILogger<ArtifactBucketInitializer> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        foreach (var (key, store) in _options.AllStores)
        {
            try
            {
                await EnsureBucketAsync(store.BucketName, cancellationToken).ConfigureAwait(false);
                await ApplyLifecycleAsync(store, cancellationToken).ConfigureAwait(false);
            }
#pragma warning disable CA1031 // Niedostępny magazyn artefaktów nie może przewrócić startu modułu.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                LogBucketSetupFailed(_logger, key, store.BucketName, _options.Endpoint, Diagnose(ex, _options), ex);
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Kody, którymi S3 odpowiada na problem z <b>tożsamością</b>, a nie z żądaniem. Sprawdzane
    /// w treści wyjątku, bo SDK mapuje je niejednolicie: część trafia na własne typy
    /// (<see cref="AccessDeniedException"/>), część zostaje surowym <c>ErrorResponseException</c>
    /// z kodem wyłącznie w komunikacie.
    /// </summary>
    private static readonly string[] AuthErrorCodes =
        ["InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied"];

    /// <summary>
    /// Zamienia wyjątek z magazynu na wskazówkę, od czego zacząć naprawę.
    ///
    /// <para>Bez tego rozróżnienia log mówi tylko „nie udało się", a trzy zupełnie różne przyczyny
    /// — martwy adres, nieistniejące konto, za wąska polityka — wyglądają identycznie. W dev
    /// dominuje środkowa: konto zakłada <c>minio-init</c> z docker-compose i wystarczy postawić
    /// stack usługa po usłudze, żeby zostało pominięte. Moduł startuje wtedy normalnie
    /// (patrz komentarz klasy), więc objaw wychodzi dopiero przy pierwszym wgrywanym pliku —
    /// daleko od przyczyny.</para>
    /// </summary>
    private static string Diagnose(Exception exception, ErpArtifactOptions options)
    {
        for (var ex = exception; ex is not null; ex = ex.InnerException)
        {
            if (ex is ConnectionException or HttpRequestException or SocketException)
            {
                return $"Magazyn nie odpowiada pod `{options.Endpoint}` — sprawdź, czy kontener MinIO stoi "
                    + "i czy port zgadza się z `Artifacts:Endpoint`.";
            }

            if (ex is AccessDeniedException or AuthorizationException or ForbiddenException
                || Array.Exists(AuthErrorCodes, code => ex.Message.Contains(code, StringComparison.OrdinalIgnoreCase)))
            {
                return $"Magazyn odrzucił konto `{options.AccessKey}`. W dev prawie zawsze znaczy to, że konto "
                    + "nie istnieje, bo nie wstał kontener `minio-init` — postaw go przez "
                    + "`podman compose -f backend/docker-compose.yml up minio-init`. Jeśli konto istnieje, "
                    + "to jego polityka nie daje `s3:CreateBucket` ani `s3:PutLifecycleConfiguration` "
                    + "na tym kubełku (patrz backend/minio/policies/README.md).";
            }
        }

        return "Przyczyna nie jest typowa — szczegóły w wyjątku poniżej.";
    }

    private async Task EnsureBucketAsync(string bucketName, CancellationToken cancellationToken)
    {
        var exists = await _client
            .BucketExistsAsync(
                new Minio.DataModel.Args.BucketExistsArgs().WithBucket(bucketName),
                cancellationToken)
            .ConfigureAwait(false);

        if (exists)
        {
            return;
        }

        await _client
            .MakeBucketAsync(
                new Minio.DataModel.Args.MakeBucketArgs().WithBucket(bucketName),
                cancellationToken)
            .ConfigureAwait(false);

        LogBucketCreated(_logger, bucketName);
    }

    /// <summary>
    /// Ustawia reguły wygasania: poczekalnię sprząta zawsze, całość kubełka — tylko gdy magazyn
    /// ma zadeklarowaną retencję.
    ///
    /// <para>Reguła w magazynie jest <b>sprzątaczką, nie źródłem prawdy</b> — o tym, czy artefakt
    /// wolno jeszcze pobrać, decyduje <c>job.expire_on</c> sprawdzane przez endpoint. Gdyby to
    /// magazyn rozstrzygał, użytkownik zamiast czytelnej odmowy dostawałby 404 z presigned URL-a,
    /// czyli błąd wyglądający na awarię. Wyjątkiem jest poczekalnia: tam magazyn JEST jedynym
    /// źródłem prawdy, bo obiekt bez wiersza w bazie nie ma innego mechanizmu, który by go
    /// rozpoznał.</para>
    ///
    /// <para>Ustawiane przy każdym starcie, bo zmiana retencji w konfiguracji ma dotrzeć do
    /// kubełka bez ręcznego kroku — dokładnie tak jak samo założenie kubełka.</para>
    /// </summary>
    private async Task ApplyLifecycleAsync(ErpArtifactStoreOptions store, CancellationToken cancellationToken)
    {
        var rules = new List<LifecycleRule>
        {
            new(
                abortIncompleteMultipartUpload: null,
                id: StagingRuleId,
                expiration: new Expiration { Days = _options.StagingRetentionDays },
                transition: null,
                filter: new RuleFilter(null, MinioArtifactStore.StagingPrefix, null),
                noncurrentVersionExpiration: null,
                noncurrentVersionTransition: null,
                status: LifecycleRule.LifecycleRuleStatusEnabled),
        };

        if (store.RetentionDays is { } retentionDays)
        {
            rules.Add(new LifecycleRule(
                abortIncompleteMultipartUpload: null,
                id: RetentionRuleId,
                expiration: new Expiration { Days = retentionDays },
                transition: null,
                // Pusty prefiks = cały kubełek. Wolno tak tylko dlatego, że kubełek jest
                // dedykowany jednej klasie plików jednego modułu (patrz ErpArtifactStoreOptions).
                filter: new RuleFilter(null, string.Empty, null),
                noncurrentVersionExpiration: null,
                noncurrentVersionTransition: null,
                status: LifecycleRule.LifecycleRuleStatusEnabled));
        }

        await _client
            .SetBucketLifecycleAsync(
                new Minio.DataModel.Args.SetBucketLifecycleArgs()
                    .WithBucket(store.BucketName)
                    .WithLifecycleConfiguration(new LifecycleConfiguration(rules)),
                cancellationToken)
            .ConfigureAwait(false);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Założono kubełek artefaktów {Bucket}.")]
    private static partial void LogBucketCreated(ILogger logger, string bucket);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Nie udało się przygotować magazynu {Store} (kubełek {Bucket}) pod adresem {Endpoint}. "
            + "{Hint} Operacje na plikach będą kończyć się błędem do czasu naprawy.")]
    private static partial void LogBucketSetupFailed(
        ILogger logger,
        string store,
        string bucket,
        string endpoint,
        string hint,
        Exception exception);
}
