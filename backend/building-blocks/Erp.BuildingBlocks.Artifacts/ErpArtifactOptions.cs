using System.Collections.ObjectModel;

namespace Erp.BuildingBlocks.Artifacts;

/// <summary>
/// Jeden magazyn modułu — kubełek plus polityka wygasania. Osobny typ, bo różnica między
/// magazynami jest dziś jedna (retencja), a jutro może być ich więcej (versioning, object-lock);
/// para pól w opcjach głównych nie rozciągnęłaby się na trzecią klasę plików.
/// </summary>
public sealed class ErpArtifactStoreOptions
{
    /// <summary>
    /// Kubełek w magazynie. Konwencja nazw: <c>erp-{moduł}-{klasa}</c>, np.
    /// <c>erp-catalog-media</c>.
    ///
    /// <para><b>Kubełek jest per moduł, nie wspólny dla całego systemu.</b> Reguła lifecycle
    /// jest w S3 własnością kubełka, a zakłada ją każdy moduł przy starcie — dwa moduły z różną
    /// retencją na jednym kubełku nadpisywałyby ją sobie nawzajem przy każdym restarcie, cicho
    /// i bez błędu. Do tego object-lock, versioning i quota też są ustawieniami kubełka.</para>
    /// </summary>
    public string BucketName { get; set; } = string.Empty;

    /// <summary>
    /// Ile dni żyje obiekt w tym kubełku. <c>null</c> = zawartość trwała, bez reguły wygasania.
    ///
    /// <para><b>Jedno źródło prawdy o retencji</b>: ta sama wartość ustawia <c>job.expire_on</c>
    /// przy zakładaniu przebiegu eksportu i regułę lifecycle w kubełku. Rozdzielenie tych dwóch
    /// liczb jest widoczne dla użytkownika w obie strony: krótsza retencja w magazynie daje
    /// przycisk „Pobierz" prowadzący do 404, dłuższa — pliki, które zostają na zawsze i o których
    /// nikt nie wie.</para>
    /// </summary>
    public int? RetentionDays { get; set; }
}

/// <summary>
/// Konfiguracja magazynów artefaktów, sekcja <c>Artifacts</c> w <c>appsettings</c>.
/// </summary>
public sealed class ErpArtifactOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Artifacts";

    /// <summary>
    /// Adres API S3 bez schematu, np. <c>localhost:9100</c>. Port jest przesunięty względem
    /// domyślnego 9000, bo ten bywa zajęty na maszynach deweloperskich — patrz
    /// <c>backend/docker-compose.yml</c>.
    /// </summary>
    public string Endpoint { get; set; } = "localhost:9100";

    /// <summary>
    /// Konto MinIO <b>tego serwisu</b>, nie konto root.
    ///
    /// <para>Polityka przypięta do tego konta ogranicza je do kubełków modułu, więc błąd w kodzie
    /// — pomylony identyfikator, wstrzyknięty nie ten magazyn — nie sięgnie po cudze pliki.
    /// To jedyna warstwa separacji, która trzyma przy pomyłce programisty, a nie tylko przy
    /// poprawnym kodzie. Konta i polityki zakłada <c>minio-init</c> z docker-compose.</para>
    /// </summary>
    public string AccessKey { get; set; } = string.Empty;

    /// <inheritdoc cref="AccessKey"/>
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>TLS. W dev wyłączone; na produkcji musi być włączone, bo presigned URL niesie podpis.</summary>
    public bool UseSsl { get; set; }

    /// <summary>
    /// Czas życia adresu wgrywania (presigned <c>PUT</c>). Dłuższy niż
    /// <see cref="DownloadUrlTtl"/>, bo po drugiej stronie jest transfer pliku przez łącze
    /// użytkownika, a nie samo kliknięcie.
    /// </summary>
    public TimeSpan UploadUrlTtl { get; set; } = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Domyślny czas życia adresu pobrania. Minuty, nie dni: link jest bearer-owy, więc jego
    /// TTL jest jedyną rzeczą ograniczającą szkodę z wycieku.
    /// </summary>
    public TimeSpan DownloadUrlTtl { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Po ilu dniach magazyn kasuje obiekt, który utknął pod prefiksem postojowym.
    ///
    /// <para>To jest cały mechanizm sprzątania plików wgranych przez użytkownika, po których
    /// nigdy nie przyszła komenda rejestrująca — użytkownik zamknął kartę między transferem
    /// a zapisem. Taki obiekt nie ma wiersza w bazie, więc <b>nic w systemie nie wie, że
    /// istnieje</b>; jedynym, co potrafi go rozpoznać, jest prefiks i wiek. Doba z zapasem
    /// pokrywa <see cref="UploadUrlTtl"/> i najdłuższą sesję wgrywania.</para>
    /// </summary>
    public int StagingRetentionDays { get; set; } = 1;

    /// <summary>
    /// Magazyny modułu, po kluczu z <c>ArtifactStoreKeys</c>. Wpis <c>transient</c> jest
    /// jednocześnie rejestracją domyślną (bezkluczową) w kontenerze DI.
    /// </summary>
    public Dictionary<string, ErpArtifactStoreOptions> Stores { get; } =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Magazyn spod danego klucza albo czytelny wyjątek. Konfiguracja bez wpisu, po który sięga
    /// kod, jest błędem wdrożeniowym — a domyślny kubełek „na wszelki wypadek" byłby dokładnie
    /// tym cichym rozjazdem, którego ten podział ma unikać.
    /// </summary>
    public ErpArtifactStoreOptions RequireStore(string key)
        => Stores.TryGetValue(key, out var store)
            ? store
            : throw new InvalidOperationException(
                $"Brak magazynu `{key}` w konfiguracji `{SectionName}:Stores`. "
                + $"Skonfigurowane: {(Stores.Count == 0 ? "(żaden)" : string.Join(", ", Stores.Keys))}.");

    /// <summary>Widok tylko do odczytu dla inicjalizatora kubełków.</summary>
    public ReadOnlyDictionary<string, ErpArtifactStoreOptions> AllStores => new(Stores);
}
