namespace TaskManagement.Application.Issues;

/// <summary>
/// Strona odczytu pracy zalogowanej i osobistych widoków listy.
///
/// <para>Same komendy leżą w <c>TaskManagement.Application.WorkLogs</c>
/// i <c>TaskManagement.Application.SavedIssueViews</c> — to osobne agregaty. Odczyt zostaje tutaj,
/// bo oba zestawy danych czyta się wyłącznie w kontekście listy zgłoszeń i karty zgłoszenia,
/// a jedna implementacja <c>WorkLogQueries</c> obsługuje oba zapytania.</para>
/// </summary>
public sealed record WorkLogDto(Guid Uuid, Guid IssueUuid, Guid AuthorUuid, int Minutes, string? Note, DateTimeOffset LoggedAt);

public sealed record SavedIssueViewDto(Guid Uuid, string Name, string FilterJson, string ColumnsJson, bool IsDefault);

public sealed class GetIssueWorkLogsRequest { public Guid IssueUuid { get; set; } }

public interface IWorkLogQueries
{
    Task<IReadOnlyList<WorkLogDto>> GetForIssueAsync(Guid issueUuid, CancellationToken cancellationToken);
    Task<IReadOnlyList<SavedIssueViewDto>> GetSavedViewsAsync(CancellationToken cancellationToken);
}
