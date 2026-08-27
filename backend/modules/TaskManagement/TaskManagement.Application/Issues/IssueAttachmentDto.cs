namespace TaskManagement.Application.Issues;

/// <summary>Załącznik zgłoszenia w widoku odczytu. <c>ArtifactUuid</c> celowo NIE wychodzi
/// poza backend — zasób adresuje się uuid-em załącznika.</summary>
public sealed record IssueAttachmentDto(
    Guid Uuid,
    Guid IssueUuid,
    string FileName,
    string MimeType,
    long FileSize,
    bool IsImage,
    Guid UploadedByUuid,
    DateTimeOffset CreatedAt);

/// <summary>Adres do wgrania jednego pliku prosto do magazynu.</summary>
public sealed record IssueAttachmentUploadTicketDto(Guid ArtifactUuid, string Url, DateTime ExpiresOn);

/// <summary>Żądanie biletów wgrywania.</summary>
public sealed class GetIssueAttachmentUploadTicketsRequest
{
    public int Count { get; set; } = 1;
}

/// <summary>Żądanie listy załączników zgłoszenia.</summary>
public sealed class GetIssueAttachmentsRequest
{
    public Guid IssueUuid { get; set; }
}

/// <summary>Żądanie zawartości załącznika.</summary>
public sealed class GetIssueAttachmentContentRequest
{
    public Guid Uuid { get; set; }
}

/// <summary>Wskazanie pliku w magazynie do wydania — bez wychodzenia <c>ArtifactUuid</c> poza backend.</summary>
public sealed record IssueAttachmentContentRef(Guid ArtifactUuid, string FileName, string MimeType, long FileSize);

/// <summary>Odczyty załączników. Implementacja w <c>TaskManagement.Infrastructure</c>.</summary>
public interface IIssueAttachmentQueries
{
    /// <summary>Załączniki zgłoszenia, najstarsze pierwsze. Widoczność dziedziczy po zgłoszeniu —
    /// kto nie widzi zgłoszenia, nie widzi jego plików.</summary>
    Task<List<IssueAttachmentDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken);

    /// <summary>Wskazanie pliku do wydania albo <c>null</c>, gdy załącznika nie ma
    /// albo użytkownik nie ma dostępu do jego zgłoszenia.</summary>
    Task<IssueAttachmentContentRef?> GetContentRefAsync(Guid uuid, CancellationToken cancellationToken);
}
