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
