using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Plik wgrany do zgłoszenia — obrazek wklejony w opis albo zwykły załącznik.
///
/// <para><b>Właścicielem jest zgłoszenie, nie akapit.</b> To najważniejsza różnica wobec
/// multimediów w Catalogu, gdzie plik jest pozycją biblioteki współdzieloną przez wiele
/// produktów i potrzebuje osobnej tabeli referencji. Tutaj plik należy do dokładnie jednego
/// zgłoszenia (<c>issue_uuid</c> jako klucz obcy z kaskadą), więc:</para>
///
/// <list type="bullet">
///   <item>usunięcie obrazka z treści opisu <b>niczego nie osierocia</b> — plik zostaje
///     załącznikiem zgłoszenia, dokładnie jak w YouTracku;</item>
///   <item>sprzątanie jest deterministyczne — plik znika razem ze zgłoszeniem, w tej samej
///     transakcji, bez parsowania treści i bez workera zamiatającego po zerowej referencji
///     (<c>docs/backend/media-storage.md</c> §4c).</item>
/// </list>
///
/// <para>Dlatego nie ma tu odpowiednika <c>MultimediaOwnership</c>: każdy plik jest „owned",
/// bo innej możliwości w tym modelu nie ma.</para>
/// </summary>
public sealed class IssueAttachment : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueAttachment()
    {
    }

    private IssueAttachment(
        Guid uuid,
        Guid issueUuid,
        Guid artifactUuid,
        string fileName,
        string mimeType,
        long fileSize,
        Guid uploadedByUuid,
        DateTimeOffset createdAt) : base(uuid)
    {
        IssueUuid = issueUuid;
        ArtifactUuid = artifactUuid;
        FileName = fileName;
        MimeType = mimeType;
        FileSize = fileSize;
        UploadedByUuid = uploadedByUuid;
        CreatedAt = createdAt;
    }

    public Guid IssueUuid { get; private set; }

    /// <summary>
    /// Plik w magazynie artefaktów.
    ///
    /// <para>Świadomie identyfikator, a nie gotowy adres: adres do magazynu jest podpisany
    /// i krótko ważny, więc zapisany w bazie zestarzałby się w kilka minut. Zawartość wydaje
    /// endpoint modułu, który ten identyfikator wymienia na strumień — a przy okazji sprawdza
    /// uprawnienie przy każdym żądaniu.</para>
    /// </summary>
    public Guid ArtifactUuid { get; private set; }

    public string FileName { get; private set; } = string.Empty;

    public string MimeType { get; private set; } = string.Empty;

    public long FileSize { get; private set; }

    public Guid UploadedByUuid { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Czy plik da się pokazać w treści jako obrazek — decyduje o tym typ MIME
    /// z magazynu, nie rozszerzenie nazwy podanej przez klienta.</summary>
    public bool IsImage => MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Zakłada wpis dla pliku, który już leży w magazynie.
    ///
    /// <para>Rozmiar i typ MIME biorą się z odczytu magazynu, a <b>nie z deklaracji klienta</b>:
    /// bilet wgrywania jest bearer-owy i wydany z góry, więc żądanie rejestrujące może kłamać
    /// o tym, co wgrało.</para>
    /// </summary>
    public static IssueAttachment CreateUploaded(
        Guid uuid,
        Guid issueUuid,
        Guid artifactUuid,
        string fileName,
        string mimeType,
        long fileSize,
        Guid uploadedByUuid,
        DateTimeOffset createdAt)
    {
        if (issueUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.attachment_issue_empty",
                "Załącznik musi należeć do zgłoszenia.");
        }

        if (artifactUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.attachment_artifact_empty",
                "Załącznik musi wskazywać plik w magazynie.");
        }

        if (fileSize <= 0)
        {
            throw new DomainException("taskmgmt.attachment_empty_file", "Wgrany plik jest pusty.");
        }

        return new IssueAttachment(
            uuid,
            issueUuid,
            artifactUuid,
            ValidateFileName(fileName),
            string.IsNullOrWhiteSpace(mimeType) ? "application/octet-stream" : mimeType.Trim(),
            fileSize,
            uploadedByUuid,
            createdAt);
    }

    private static string ValidateFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new DomainException("taskmgmt.attachment_file_name_empty", "Nazwa pliku nie może być pusta.");
        }

        var trimmed = fileName.Trim();

        // Nazwa wraca do przeglądarki w nagłówku `Content-Disposition` i bywa podpowiedzią przy
        // zapisie na dysk — separator ścieżki w niej to nie jest coś, co ma prawo tam trafić.
        if (trimmed.Contains('/', StringComparison.Ordinal) || trimmed.Contains('\\', StringComparison.Ordinal))
        {
            throw new DomainException(
                "taskmgmt.attachment_file_name_invalid",
                "Nazwa pliku nie może zawierać separatora ścieżki.");
        }

        return trimmed.Length > 256 ? trimmed[..256] : trimmed;
    }
}
