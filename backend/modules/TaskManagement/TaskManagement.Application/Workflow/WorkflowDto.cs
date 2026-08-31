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

/// <summary>Przejście w widoku odczytu.</summary>
public sealed record WorkflowTransitionDto(
    Guid Uuid,
    Guid FromStateUuid,
    Guid ToStateUuid,
    string NameKey,
    string? RequiredPermission,
    IReadOnlyList<string> RequiredFieldCodes);

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

public sealed record WorkflowSchemeDto(
    Guid SchemeUuid,
    string SchemeName,
    bool IsSystem,
    IReadOnlyList<WorkflowStateDto> States,
    IReadOnlyList<WorkflowTransitionDto> Transitions);

public sealed record WorkflowSchemeListItemDto(Guid Uuid, string Name, bool IsSystem);

/// <summary>Żądanie schematu dla projektu.</summary>
public sealed class GetProjectWorkflowRequest
{
    public Guid ProjectUuid { get; set; }
}

/// <summary>
/// Stany faktycznie zajęte przez zgłoszenia projektu.
///
/// <para>Osobne zapytanie, a nie pole w <see cref="ProjectWorkflowDto"/>: tamten kontrakt czyta
/// każda lista, karta i tablica, a ten <c>DISTINCT</c> po zgłoszeniach jest potrzebny wyłącznie
/// na zakładce „stany” karty projektu, w momencie przestawiania schematu.</para>
/// </summary>
public sealed record ProjectStateUsageDto(Guid ProjectUuid, IReadOnlyList<Guid> UsedStateUuids);

public sealed class GetProjectStateUsageRequest { public Guid ProjectUuid { get; set; } }

public sealed class GetWorkflowSchemeRequest { public Guid SchemeUuid { get; set; } }

/// <summary>Odczyty konfiguracji obiegu. Implementacja w <c>TaskManagement.Infrastructure</c>.</summary>
public interface IWorkflowQueries
{
    Task<ProjectWorkflowDto?> GetProjectWorkflowAsync(Guid projectUuid, CancellationToken cancellationToken);
    Task<WorkflowSchemeDto?> GetWorkflowSchemeAsync(Guid schemeUuid, CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkflowSchemeListItemDto>> GetWorkflowSchemesAsync(CancellationToken cancellationToken);
}
