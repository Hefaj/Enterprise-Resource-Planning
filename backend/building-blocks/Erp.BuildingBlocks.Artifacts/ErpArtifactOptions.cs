namespace Erp.BuildingBlocks.Artifacts;

/// <summary>
/// Konfiguracja magazynu artefaktów, sekcja <c>Artifacts</c> w <c>appsettings</c>.
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

    public string AccessKey { get; set; } = "erp";

    public string SecretKey { get; set; } = "erp12345";

    /// <summary>TLS. W dev wyłączone; na produkcji musi być włączone, bo presigned URL niesie podpis.</summary>
    public bool UseSsl { get; set; }

    /// <summary>
    /// Kubełek na artefakty <b>wygasające</b> — eksporty, raporty, dokumenty produkowane przez
    /// system. Jeden na moduł — nazwa idzie z konfiguracji, a nie z kodu, żeby dwa mikroserwisy
    /// na tym samym MinIO nie mieszały sobie plików.
    ///
    /// <para>Obowiązuje w nim reguła lifecycle z <see cref="RetentionDays"/>, założona
    /// na CAŁY kubełek. Nic, co ma przeżyć dłużej niż retencja, nie może tu trafić.</para>
    /// </summary>
    public string BucketName { get; set; } = "erp-artifacts";

    /// <summary>
    /// Kubełek na zawartość <b>trwałą</b> — pliki wgrane przez użytkownika, żyjące tak długo,
    /// jak agregat, który je opisuje (zdjęcia produktów, załączniki).
    ///
    /// <para><b>Musi być inny niż <see cref="BucketName"/></b>, i to nie kosmetycznie: reguła
    /// wygasania jest w S3 własnością kubełka, a ta, którą zakłada moduł, ma pusty prefiks —
    /// obejmuje więc wszystko, co w kubełku leży. Zdjęcie produktu zapisane obok eksportów
    /// zniknęłoby po <see cref="RetentionDays"/> dniach, bez śladu w logu i bez błędu:
    /// widoczne dopiero jako puste miniaturki w katalogu.</para>
    /// </summary>
    public string MediaBucketName { get; set; } = "erp-media";

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
    /// Ile dni artefakt jest dostępny. <b>Jedno źródło prawdy o retencji</b>: ta sama wartość
    /// ustawia <c>job.expire_on</c> przy zakładaniu przebiegu i regułę lifecycle w kubełku.
    ///
    /// <para>Rozdzielenie tych dwóch liczb jest widoczne dla użytkownika i to w obie strony:
    /// krótsza retencja w magazynie daje przycisk „Pobierz" prowadzący do 404, dłuższa —
    /// pliki, które zostają na zawsze i o których nikt nie wie.</para>
    /// </summary>
    public int RetentionDays { get; set; } = 7;
}
