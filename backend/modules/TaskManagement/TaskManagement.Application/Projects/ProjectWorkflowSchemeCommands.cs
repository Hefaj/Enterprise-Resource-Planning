using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Workflow;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Projects;

/// <summary>
/// Przestawia projekt na inny automat stanów.
///
/// <para>Do fazy 7 schemat stanów dawało się ustawić <b>wyłącznie przy zakładaniu projektu</b>
/// (<c>Project.Create</c>), więc edytor schematów z §4.3 nie miał jak dojść do skutku: dało się
/// schemat założyć i opublikować, ale nie dało się go nikomu przypisać.</para>
///
/// <para><b>Kolejność jest odwrotna, niż podpowiada intuicja</b>: najpierw przestawiamy projekt,
/// potem migrujemy zgłoszenia. Zadanie migracyjne wybiera cele przez
/// <see cref="IWorkflowStateUsageProbe.GetIssueUuidsInStateAsync"/>, które łączy zgłoszenie
/// z projektem, a projekt ze schematem — dopóki projekt wskazuje stary schemat, filtr po nowym
/// nie zwróci niczego. Ten sam układ ma publikacja schematu (§5.3): komenda sprawdza kompletność
/// mapowania, a doprowadzenie zgłoszeń do nowych stanów idzie osobnym zadaniem masowym.</para>
/// </summary>
public sealed class ProjectSetWorkflowSchemeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid WorkflowSchemeUuid { get; set; }

    /// <summary>
    /// Stan starego schematu → stan nowego. Wymagane dla każdego stanu, w którym faktycznie siedzi
    /// jakieś zgłoszenie tego projektu i którego nowy schemat nie zna. Stan o tym samym uuidzie
    /// w obu schematach mapowania nie potrzebuje.
    /// </summary>
    public Dictionary<Guid, Guid> StateMappings { get; set; } = [];
}

public sealed class ProjectSetWorkflowSchemeCommandHandler : CommandHandler<ProjectSetWorkflowSchemeCommand, Guid>
{
    private readonly IProjectRepository _projects;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IWorkflowStateUsageProbe _usage;

    public ProjectSetWorkflowSchemeCommandHandler(
        IProjectRepository projects,
        IWorkflowSchemeRepository schemes,
        IWorkflowStateUsageProbe usage)
    {
        _projects = projects;
        _schemes = schemes;
        _usage = usage;
    }

    public override async Task<Guid> ExecuteAsync(ProjectSetWorkflowSchemeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _projects.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        if (project.WorkflowSchemeUuid == command.WorkflowSchemeUuid)
        {
            return project.Uuid;
        }

        var target = await _schemes.FindAsync(command.WorkflowSchemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.WorkflowSchemeUuid);

        var targetStates = target.States.Select(state => state.Uuid).ToHashSet();
        var used = await _usage.GetUsedStateUuidsInProjectAsync(project.Uuid, ct).ConfigureAwait(false);

        var unmapped = used
            .Where(state => !targetStates.Contains(state))
            .Where(state => !command.StateMappings.TryGetValue(state, out var mapped) || !targetStates.Contains(mapped))
            .ToList();

        if (unmapped.Count > 0)
        {
            throw new DomainException(
                "taskmgmt.project_workflow_migration_mapping_incomplete",
                "Każdy zajęty stan spoza nowego schematu wymaga wskazania stanu docelowego.");
        }

        project.SetWorkflowScheme(command.WorkflowSchemeUuid);

        return project.Uuid;
    }
}
