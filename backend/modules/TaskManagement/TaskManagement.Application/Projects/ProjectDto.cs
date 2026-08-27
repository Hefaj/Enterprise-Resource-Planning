using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Application.Projects;

/// <summary>Członek projektu w widoku odczytu.</summary>
public sealed record ProjectMemberDto(Guid UserUuid, ProjectMemberRole Role);

/// <summary>Projekt w widoku odczytu.</summary>
public sealed record ProjectDto(
    Guid Uuid,
    string Code,
    string Name,
    ProjectKind Kind,
    Guid WorkflowSchemeUuid,
    /// <summary>Schemat pól niestandardowych albo <c>null</c> — projekt bez pól własnych to
    /// stan normalny, nie brak konfiguracji.</summary>
    Guid? FieldSchemeUuid,
    bool IsPublic,
    int OpenIssueCount,
    IReadOnlyList<ProjectMemberDto> Members);

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
