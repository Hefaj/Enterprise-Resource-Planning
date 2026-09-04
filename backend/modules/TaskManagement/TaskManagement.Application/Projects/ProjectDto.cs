using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Application.Projects;

/// <summary>Członek projektu w widoku odczytu.</summary>
public sealed record ProjectMemberDto(Guid UserUuid, ProjectMemberRole Role);

/// <summary>Polityka SLA projektu w widoku odczytu — <c>null</c> znaczy „nieskonfigurowana"
/// (PRJ-006, faza 5).</summary>
public sealed record ProjectSlaDto(
    int ResponseMinutes,
    int ResolutionMinutes,
    SlaWorkingDays WorkingDays,
    TimeOnly WorkStartTime,
    TimeOnly WorkEndTime);

/// <summary>Projekt w widoku odczytu.</summary>
public sealed record ProjectDto(
    Guid Uuid,
    string Code,
    string Name,
    ProjectKind Kind,
    Guid WorkflowSchemeUuid,
    Guid IssueTypeSchemeUuid,
    /// <summary>Schemat pól niestandardowych albo <c>null</c> — projekt bez pól własnych to
    /// stan normalny, nie brak konfiguracji.</summary>
    Guid? FieldSchemeUuid,
    bool IsPublic,
    int OpenIssueCount,
    IReadOnlyList<ProjectMemberDto> Members,
    ProjectSlaDto? Sla,
    /// <summary>Projekt archiwalny (PRJ-004) — tylko do odczytu, ukryty z domyślnych list.</summary>
    bool IsArchived,
    /// <summary>Widok domyślny (VIEW-002) — <c>null</c> znaczy brak, stan normalny.</summary>
    Guid? DefaultSavedViewUuid,
    /// <summary>Czy WOŁAJĄCY wyciszył powiadomienia z tego projektu (NTF-003) — ustawienie
    /// osobiste, ten sam wzorzec co <c>IssueDto.IsWatchedByMe</c>.</summary>
    bool IsNotificationMutedByMe);

/// <summary>Filtry wyszukiwania projektów.</summary>
public sealed class SearchProjectRequest : PagedRequest
{
    public string? Text { get; set; }

    public ProjectKind? Kind { get; set; }

    /// <summary>Tylko projekty, w których jestem członkiem — zakres listy zleceń i przełącznika
    /// kontekstu projektu na liście zgłoszeń.
    ///
    /// <para>Nullowalne z tego samego powodu co <c>SearchIssueRequest.Scope</c>: formularz filtrów
    /// wysyła <c>null</c> dla pól, których użytkownik nie tknął, a nienullowalny typ wywala
    /// deserializację żądania błędem 400 zanim dojdzie ono do zapytania.</para></summary>
    public bool? OnlyMine { get; set; }

    /// <summary>Domyślnie <c>false</c> — projekt archiwalny znika z domyślnej listy i z pickera
    /// przy tworzeniu zgłoszenia (PRJ-004). Ustawienie na <c>true</c> pokazuje WYŁĄCZNIE
    /// archiwalne, wzorem przełącznika w karcie projektu, nie sumę obu zbiorów: karta projektu
    /// pokazuje albo bieżące, albo archiwum, nigdy oba naraz na jednej liście.</summary>
    public bool IncludeArchived { get; set; }
}

/// <summary>Pobranie projektów po identyfikatorach.</summary>
public sealed class GetProjectRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Odczyty projektów. Implementacja w <c>TaskManagement.Infrastructure</c>.</summary>
public interface IProjectQueries
{
    Task<SearchResponse> SearchAsync(SearchProjectRequest request, CancellationToken cancellationToken);

    Task<List<ProjectDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    Task<List<Guid>> GetMatchingUuidsAsync(SearchProjectRequest request, CancellationToken cancellationToken);
}

/// <summary>Wąski odczyt wyciszeń powiadomień per projekt (NTF-003) — używany wyłącznie przez
/// <c>IssueNotificationPublisher</c> do odfiltrowania odbiorców, więc nie ma powodu przeciągać
/// przez niego całego <see cref="IProjectQueries"/>. Implementacja w
/// <c>TaskManagement.Infrastructure</c>.</summary>
public interface IProjectNotificationMuteQueries
{
    Task<HashSet<Guid>> GetMutedUserUuidsAsync(Guid projectUuid, CancellationToken cancellationToken);
}
