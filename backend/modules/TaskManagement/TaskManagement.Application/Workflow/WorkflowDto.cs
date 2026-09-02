using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Workflow;

/// <summary>Stan schematu w widoku odczytu. <c>NameKey</c> to klucz Transloco —
/// front nie dostaje gotowego napisu, bo nazwy stanów są konfiguracją, a konfiguracja
/// nie jest tłumaczona po stronie backendu.</summary>
public sealed record WorkflowStateDto(
    Guid Uuid,
    string Code,
    string NameKey,
    WorkflowStateCategory Category,
    int OrderNo);

/// <summary>Przejście w widoku odczytu. <c>RequiredFields</c> to kody pól niestandardowych
/// (<c>FieldDefinition.Code</c>), które front musi zebrać przed wysłaniem komendy — pusta lista
/// znaczy „bez dodatkowego wymogu” (WF-004).</summary>
public sealed record WorkflowTransitionDto(
    Guid Uuid,
    Guid FromStateUuid,
    Guid ToStateUuid,
    string NameKey,
    string? RequiredPermission,
    IReadOnlyList<string> RequiredFields);

/// <summary>
/// Schemat stanów projektu — <b>jedno źródło prawdy dla kolumn tablicy, przycisków przejść
/// na karcie i filtra stanu na liście</b>. Front nie zna żadnego stanu z twardej stałej;
/// wszystko, co rysuje, pochodzi stąd.
/// </summary>
public sealed record ProjectWorkflowDto(
    Guid ProjectUuid,
    Guid SchemeUuid,
    string SchemeName,
    IReadOnlyList<WorkflowStateDto> States,
    IReadOnlyList<WorkflowTransitionDto> Transitions);

/// <summary>Żądanie schematu dla projektu.</summary>
public sealed class GetProjectWorkflowRequest
{
    public Guid ProjectUuid { get; set; }
}

/// <summary>Odczyty konfiguracji obiegu. Implementacja w <c>TaskManagement.Infrastructure</c>.</summary>
public interface IWorkflowQueries
{
    Task<ProjectWorkflowDto?> GetProjectWorkflowAsync(Guid projectUuid, CancellationToken cancellationToken);
}

/// <summary>Schemat stanów w widoku odczytu dla edytora schematu (WF-007) — dwie listy
/// (stany, przejścia); macierz „z → do" front buduje z tych samych <c>Transitions</c>, bez
/// osobnego zapytania.</summary>
public sealed record WorkflowSchemeDto(
    Guid Uuid,
    string Name,
    bool IsSystem,
    List<WorkflowStateDto> States,
    List<WorkflowTransitionDto> Transitions);

/// <summary>Żądanie listy schematów stanów.</summary>
public sealed class SearchWorkflowSchemeRequest
{
    /// <summary>Fragment nazwy. Pusty zwraca wszystkie.</summary>
    public string? Text { get; set; }
}

/// <summary>Żądanie pojedynczego schematu.</summary>
public sealed class GetWorkflowSchemeRequest
{
    public Guid Uuid { get; set; }
}

/// <summary>Odczyty schematów stanów — konfiguracja projektu (WF-007), analogicznie do
/// <c>IIssueTypeSchemeQueries</c>.</summary>
public interface IWorkflowSchemeQueries
{
    Task<List<WorkflowSchemeDto>> SearchAsync(SearchWorkflowSchemeRequest request, CancellationToken cancellationToken);

    Task<WorkflowSchemeDto?> GetAsync(Guid uuid, CancellationToken cancellationToken);
}

/// <summary>Jeden kandydat do usunięcia w publikacji — stan i liczba zgłoszeń, które w nim
/// siedzą, do pokazania na ekranie decyzji PRZED wysłaniem <c>WorkflowSchemeExecPublishCommand</c>
/// (WF-006, wzorzec identyczny jak <c>IssueMoveToProjectPreviewDto</c>).</summary>
public sealed record WorkflowStatePublishCandidateDto(Guid StateUuid, string Code, string NameKey, int IssueCount);

/// <summary>Stan, który PRZETRWA publikację — lista, z której front buduje picker celu migracji;
/// stan właśnie usuwany nie może być swoim własnym celem.</summary>
public sealed record WorkflowStatePublishTargetDto(Guid StateUuid, string Code, string NameKey);

/// <summary>Podgląd publikacji — dla każdego stanu wskazanego do usunięcia mówi, ile zgłoszeń
/// wymaga decyzji o migracji, oraz podaje zbiór stanów, do których wolno je przenieść.</summary>
public sealed record WorkflowSchemePublishPreviewDto(
    Guid SchemeUuid,
    List<WorkflowStatePublishCandidateDto> StatesToRemove,
    List<WorkflowStatePublishTargetDto> AvailableTargets);

/// <summary>Żądanie podglądu publikacji.</summary>
public sealed class GetWorkflowSchemePublishPreviewRequest
{
    public Guid SchemeUuid { get; set; }

    public List<Guid> StatesToRemove { get; set; } = [];
}

/// <summary>Odczyt podglądu publikacji (WF-006) — implementacja w <c>TaskManagement.Infrastructure</c>.</summary>
public interface IWorkflowSchemePublishPreviewQueries
{
    Task<WorkflowSchemePublishPreviewDto> PreviewAsync(
        GetWorkflowSchemePublishPreviewRequest request,
        CancellationToken cancellationToken);
}

/// <summary>Jedno zgłoszenie dotknięte publikacją — jego uuid i stan, w którym akurat siedzi,
/// zebrane PRZED wywołaniem <see cref="Domain.Workflow.WorkflowScheme.Publish"/> (patrz handler
/// <c>WorkflowSchemeExecPublishCommandHandler</c>: po publikacji stan już nie istnieje w schemacie).</summary>
public sealed record WorkflowSchemeAffectedIssueDto(Guid IssueUuid, Guid StateUuid);

/// <summary>Zapytanie o zgłoszenia siedzące w zbiorze stanów — używane wyłącznie przez handler
/// publikacji do zbudowania zadania masowego migracji (WF-006 AC3). Osobno od
/// <see cref="IWorkflowSchemePublishPreviewQueries"/>, bo podgląd zwraca tylko liczby, a handler
/// potrzebuje uuidów zgłoszeń do zbudowania <c>job_item</c>-ów.</summary>
public interface IWorkflowSchemePublishIssueQueries
{
    Task<IReadOnlyList<WorkflowSchemeAffectedIssueDto>> FindByStatesAsync(
        IReadOnlyList<Guid> stateUuids,
        CancellationToken cancellationToken);
}
