using TaskManagement.Domain.IssueTypes;

namespace TaskManagement.Application.IssueTypes;

/// <summary>Schemat typów zgłoszeń w widoku odczytu — ekran konfiguracji projektu (zakładka
/// „Typy") i modal tworzenia zgłoszenia.</summary>
public sealed record IssueTypeSchemeDto(
    Guid Uuid,
    string Name,
    bool IsSystem,
    List<IssueTypeDto> Types);

/// <summary>Typ zgłoszenia w widoku odczytu.</summary>
public sealed record IssueTypeDto(
    Guid Uuid,
    string Code,
    string Name,
    string? NameKey,
    string Icon,
    IssueTypeCategory Category,
    int OrderNo,
    Guid? WorkflowSchemeUuid,
    Guid? FieldSchemeUuid);

/// <summary>Żądanie listy schematów typów.</summary>
public sealed class SearchIssueTypeSchemeRequest
{
    /// <summary>Fragment nazwy. Pusty zwraca wszystkie.</summary>
    public string? Text { get; set; }
}

/// <summary>Żądanie pojedynczego schematu.</summary>
public sealed class GetIssueTypeSchemeRequest
{
    public Guid Uuid { get; set; }
}

/// <summary>Odczyty schematów typów zgłoszeń.</summary>
public interface IIssueTypeSchemeQueries
{
    Task<List<IssueTypeSchemeDto>> SearchAsync(SearchIssueTypeSchemeRequest request, CancellationToken cancellationToken);

    Task<IssueTypeSchemeDto?> GetAsync(Guid uuid, CancellationToken cancellationToken);
}
