using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Multimedia;

/// <summary>
/// Czyj jest plik — i przez to, kiedy wolno go skasować.
///
/// <para>To rozróżnienie istnieje po to, żeby <b>nie zgadywać własności z licznika referencji</b>.
/// „Nikt tego teraz nie używa" nie znaczy „to śmieć": użytkownik, który odpina zdjęcie od
/// produktu, żeby przepiąć je do innego, nie prosi o skasowanie pliku. Kasowanie po zerowej
/// referencji usuwałoby jego dane w oknie między dwoma kliknięciami — nieodwracalnie
/// i niewidocznie (<c>docs/guides/backend/media-storage.md</c> §4c).</para>
/// </summary>
public enum MultimediaOwnership
{
    /// <summary>
    /// Pozycja biblioteki mediów — wielokrotnego użytku, usuwana wyłącznie jawną komendą
    /// użytkownika. Licznik referencji służy tu do <b>zablokowania</b> usunięcia, a nie do
    /// jego wywołania. Domyślna, bo taki jest każdy plik wgrany przez galerię produktu:
    /// jedna paczka zdjęć trafia do wielu produktów naraz.
    /// </summary>
    Library = 0,

    /// <summary>
    /// Plik wgrany w kontekście jednego właściciela, nie do ponownego użycia — znika kaskadą
    /// w tej samej transakcji, która usuwa ostatnią referencję. Deterministycznie, bez okna
    /// wyścigu i bez zamiatania w tle.
    /// </summary>
    Owned = 1,
}

/// <summary>
/// Zasób multimedialny (zdjęcie, wideo) — osobny agregat, nie pole produktu.
///
/// Uzasadnienie granicy, wg kryteriów z sekcji 9 <c>docs/guides/frontend/orchestrators.md</c>:
/// ma własny endpoint, bywa ładowany niezależnie od produktu (flaga <c>includeMultimedia</c>),
/// jest współdzielony między agregatami i ma własny cykl życia (upload, usunięcie).
/// Frontend potwierdza tę granicę osobnym orkiestratorem o sygnaturze <c>catalog.multimedia</c>.
/// </summary>
public class MultimediaAsset : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected MultimediaAsset()
    {
    }

    private MultimediaAsset(
        Guid uuid,
        string fileName,
        string mediaType,
        string? thumbnailUrl,
        string? originalUrl,
        Guid? artifactUuid,
        long fileSize,
        string mimeType,
        int sortOrder,
        DateTimeOffset createdAt,
        MultimediaOwnership ownership) : base(uuid)
    {
        FileName = fileName;
        MediaType = mediaType;
        ThumbnailUrl = thumbnailUrl;
        OriginalUrl = originalUrl;
        ArtifactUuid = artifactUuid;
        FileSize = fileSize;
        MimeType = mimeType;
        SortOrder = sortOrder;
        CreatedAt = createdAt;
        Ownership = ownership;
    }

    public string FileName { get; private set; } = string.Empty;

    /// <summary>Rodzaj zasobu w ujęciu ogólnym (<c>image</c>, <c>video</c>).</summary>
    public string MediaType { get; private set; } = string.Empty;

    /// <summary>Jedyny rodzaj, dla którego umiemy dziś zrobić wariant pochodny.</summary>
    public const string ImageMediaType = "image";

    public string? ThumbnailUrl { get; private set; }

    /// <summary>
    /// Adres zasobu trzymanego POZA systemem. Wyklucza się z <see cref="ArtifactUuid"/>:
    /// zasób jest albo cudzy i wskazany adresem, albo nasz i wskazany identyfikatorem
    /// artefaktu. Dokładnie jedno z dwóch jest wypełnione.
    /// </summary>
    public string? OriginalUrl { get; private set; }

    /// <summary>
    /// Plik w magazynie artefaktów — wypełniony dla zawartości wgranej przez użytkownika.
    ///
    /// <para>Świadomie identyfikator, a nie gotowy adres: adres do magazynu jest podpisany
    /// i krótko ważny, więc zapisany w bazie zestarzałby się w kilka minut. Zawartość wydaje
    /// endpoint modułu, który ten identyfikator wymienia na strumień — patrz
    /// <c>docs/guides/backend/exports-artifacts.md</c> §6.</para>
    /// </summary>
    public Guid? ArtifactUuid { get; private set; }

    public long FileSize { get; private set; }

    public string MimeType { get; private set; } = string.Empty;

    /// <summary>Kolejność prezentacji w galerii.</summary>
    public int SortOrder { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>
    /// Czy plik jest pozycją biblioteki, czy własnością jednego agregatu — patrz
    /// <see cref="MultimediaOwnership"/>. Rozstrzyga, czy zerowa liczba referencji jest powodem
    /// do usunięcia, czy tylko zdjęciem blokady.
    /// </summary>
    public MultimediaOwnership Ownership { get; private set; }

    /// <summary>
    /// Kiedy powstały warianty pochodne (miniaturka, podgląd); <c>null</c> = jeszcze ich nie ma.
    ///
    /// <para><b>Po co to w ogóle wiedzieć.</b> Warianty powstają asynchronicznie, po zatwierdzeniu
    /// transakcji. Bez tej flagi UI musiałby albo pytać o wariant i obsługiwać 404 jako stan
    /// normalny, albo cicho spadać na oryginał — czyli pobierać 6 MB do kwadratu 40×40, dokładnie
    /// to, przed czym warianty mają chronić. Znacznik czasu zamiast <c>bool</c>, bo przy zmianie
    /// zestawu rozmiarów pozwala odróżnić pliki wymagające ponownego przetworzenia.</para>
    /// </summary>
    public DateTimeOffset? DerivativesGeneratedAt { get; private set; }

    /// <summary>
    /// Czy dla tego zasobu w ogóle warto generować warianty. Adres zewnętrzny odpada, bo bajty
    /// nie są nasze; nie-obrazy odpadają, bo miniaturka wideo czy PDF-u wymaga innych narzędzi
    /// niż skalowanie bitmapy (patrz <c>docs/guides/backend/media-storage.md</c> §9).
    /// </summary>
    public bool SupportsDerivatives => ArtifactUuid is not null && MediaType == ImageMediaType;

    /// <summary>Oznacza, że warianty pochodne są już w magazynie.</summary>
    public void MarkDerivativesGenerated(DateTimeOffset generatedAt) => DerivativesGeneratedAt = generatedAt;

    /// <summary>Zasób wskazany adresem zewnętrznym — bajty leżą poza systemem.</summary>
    public static MultimediaAsset Create(
        string fileName,
        string mediaType,
        string? thumbnailUrl,
        string originalUrl,
        long fileSize,
        string mimeType,
        int sortOrder,
        DateTimeOffset createdAt)
        => new(NewUuid(), Validate(fileName), mediaType, thumbnailUrl, originalUrl, null,
               ValidateSize(fileSize), mimeType, sortOrder, createdAt, MultimediaOwnership.Library);

    /// <summary>
    /// Zasób wgrany przez użytkownika — bajty leżą już w magazynie artefaktów pod
    /// <paramref name="artifactUuid"/>.
    ///
    /// <para><b>Rozmiar i typ pochodzą z magazynu, nie z deklaracji klienta.</b> Przy wgrywaniu
    /// prosto do magazynu (presigned PUT) serwis nie widzi bajtów, więc jedyną wiarygodną
    /// informacją o tym, co faktycznie wylądowało, jest odczyt metadanych obiektu. Zaufanie
    /// liczbie z żądania dałoby katalog, w którym rozmiary są tym, co klient chciał wgrać,
    /// a nie tym, co wgrał.</para>
    ///
    /// <para><see cref="MediaType"/> wyprowadzamy z typu MIME, zamiast przyjmować osobno —
    /// dwa niezależne pola opisujące to samo rozjeżdżają się przy pierwszym nietypowym pliku.</para>
    /// </summary>
    public static MultimediaAsset CreateUploaded(
        Guid uuid,
        Guid artifactUuid,
        string fileName,
        string mimeType,
        long fileSize,
        int sortOrder,
        DateTimeOffset createdAt,
        MultimediaOwnership ownership = MultimediaOwnership.Library)
    {
        if (artifactUuid == Guid.Empty)
        {
            throw new DomainException(
                "multimedia_artifact_missing",
                "Zasób wgrany musi wskazywać artefakt w magazynie.");
        }

        return new(
            uuid,
            Validate(fileName),
            MediaTypeFor(mimeType),
            thumbnailUrl: null,
            originalUrl: null,
            artifactUuid,
            ValidateSize(fileSize),
            NormalizeMimeType(mimeType),
            sortOrder,
            createdAt,
            ownership);
    }

    /// <summary>
    /// Czy zasób wolno usunąć, wiedząc, ile agregatów jeszcze na niego wskazuje.
    ///
    /// <para>Reguła siedzi w agregacie, a nie w handlerze, bo to reguła biznesowa, a nie
    /// szczegół zapytania — liczbę referencji handler tylko dostarcza (agregat nie sięga do
    /// bazy, tak samo jak przy wykrywaniu cykli w rolach).</para>
    /// </summary>
    public void EnsureCanRemove(int referenceCount)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(referenceCount);

        if (referenceCount == 0)
        {
            return;
        }

        // Blokują oba rodzaje własności, ale z różnych powodów — i użytkownik ma usłyszeć ten
        // właściwy. Przy `Library` odpięcie jest normalnym krokiem, który ma wykonać sam.
        // Przy `Owned` plik nie jest jego do usunięcia: zniknie kaskadą razem z agregatem,
        // który go trzyma, więc rada „odepnij" prowadziłaby donikąd.
        throw Ownership == MultimediaOwnership.Owned
            ? new DomainException(
                "multimedia_owned_by_aggregate",
                $"Zasób należy do {referenceCount} agregatu(ów) i zniknie razem z nim — "
                + "nie usuwa się go osobno.")
            : new DomainException(
                "multimedia_still_referenced",
                $"Zasób jest używany przez {referenceCount} produkt(ów) — odepnij go najpierw.");
    }

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static MultimediaAsset CreateWithUuid(
        Guid uuid,
        string fileName,
        string mediaType,
        string? thumbnailUrl,
        string originalUrl,
        long fileSize,
        string mimeType,
        int sortOrder,
        DateTimeOffset createdAt)
        => new(uuid, Validate(fileName), mediaType, thumbnailUrl, originalUrl, null,
               ValidateSize(fileSize), mimeType, sortOrder, createdAt, MultimediaOwnership.Library);

    /// <summary>Zmienia pozycję zasobu w galerii.</summary>
    public void Reorder(int sortOrder)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(sortOrder);
        SortOrder = sortOrder;
    }

    private static string Validate(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new DomainException("multimedia_filename_empty", "Nazwa pliku nie może być pusta.");
        }

        return fileName.Trim();
    }

    /// <summary>
    /// Rodzaj zasobu w ujęciu ogólnym, wyprowadzony z typu MIME. Wartości pokrywają się
    /// z ikonami po stronie UI (<c>multimedia-thumbnail-cell.component.ts</c>); nierozpoznany
    /// typ zostaje <c>file</c>, bo UI ma dla niego ikonę domyślną i nie ma powodu odrzucać
    /// pliku tylko dlatego, że nie mieści się w naszej klasyfikacji.
    /// </summary>
    private static string MediaTypeFor(string mimeType)
    {
        var mime = NormalizeMimeType(mimeType);

        if (mime.StartsWith("image/", StringComparison.Ordinal)) return ImageMediaType;
        if (mime.StartsWith("video/", StringComparison.Ordinal)) return "video";
        if (mime.StartsWith("audio/", StringComparison.Ordinal)) return "audio";
        if (mime.StartsWith("model/", StringComparison.Ordinal)) return "3d-model";

        return mime is "application/pdf" or "application/msword"
            || mime.StartsWith("text/", StringComparison.Ordinal)
            || mime.StartsWith("application/vnd.openxmlformats-officedocument.", StringComparison.Ordinal)
                ? "document"
                : "file";
    }

    private static string NormalizeMimeType(string mimeType)
    {
        if (string.IsNullOrWhiteSpace(mimeType))
        {
            return "application/octet-stream";
        }

        // Przeglądarka dokłada do typu parametry (`text/plain; charset=utf-8`) — do klasyfikacji
        // i do nagłówka odpowiedzi liczy się sam typ.
        var mime = mimeType.Trim().ToLowerInvariant();
        var separator = mime.IndexOf(';', StringComparison.Ordinal);

        return separator < 0 ? mime : mime[..separator].TrimEnd();
    }

    private static long ValidateSize(long fileSize)
    {
        if (fileSize < 0)
        {
            throw new DomainException("multimedia_size_invalid", "Rozmiar pliku nie może być ujemny.");
        }

        return fileSize;
    }
}
