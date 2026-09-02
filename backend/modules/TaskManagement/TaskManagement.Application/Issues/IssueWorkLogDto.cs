namespace TaskManagement.Application.Issues;

/// <summary>Wpis czasu w widoku odczytu — dane strukturalne dla sekcji czasu na karcie
/// (suma, edycja), w odróżnieniu od zdania w strumieniu aktywności (<c>IssueActivityDto</c>),
/// które niesie tylko tekst.</summary>
public sealed record IssueWorkLogDto(
    Guid Uuid,
    Guid IssueUuid,
    Guid UserUuid,
    Guid WorkTypeUuid,
    DateOnly LoggedOn,
    int Minutes,
    string? Description,
    DateTimeOffset CreatedAt,
    /// <summary>Czy bieżący użytkownik jest autorem — steruje widocznością przycisku usunięcia
    /// (<see cref="Issues.IssueRemoveWorkLogCommand"/> odrzuca cudzy wpis).</summary>
    bool IsMine);

/// <summary>Żądanie listy wpisów czasu zgłoszenia.</summary>
public sealed class GetIssueWorkLogsRequest
{
    public Guid IssueUuid { get; set; }
}

/// <summary>Odczyty wpisów czasu. Widoczność dziedziczy po zgłoszeniu, tak samo jak komentarze
/// i historia.</summary>
public interface IIssueWorkLogQueries
{
    Task<List<IssueWorkLogDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken);
}
