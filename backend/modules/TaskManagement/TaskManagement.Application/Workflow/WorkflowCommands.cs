using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Workflow;

public sealed class WorkflowSchemeExecPublishCommand : ICommand<Guid>
{
    public Guid SchemeUuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<WorkflowStateDefinitionDto> States { get; set; } = [];
    public List<WorkflowTransitionDefinitionDto> Transitions { get; set; } = [];
    /// <summary>Stan usuwany → stan docelowy. Wymagane dla każdego używanego usuwanego stanu.</summary>
    public Dictionary<Guid, Guid> RemovedStateMappings { get; set; } = [];
}

/// <summary>Zakłada edytowalny schemat z minimalnym stanem początkowym.</summary>
public sealed class WorkflowSchemeCreateCommand : ICommand<Guid>
{
    public string Name { get; set; } = string.Empty;
}

public sealed class WorkflowSchemeCreateCommandHandler : CommandHandler<WorkflowSchemeCreateCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;
    public WorkflowSchemeCreateCommandHandler(IWorkflowSchemeRepository schemes) => _schemes = schemes;
    public override Task<Guid> ExecuteAsync(WorkflowSchemeCreateCommand command, CancellationToken ct = default)
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), command.Name, isSystem: false);
        scheme.AddState(Guid.CreateVersion7(), "todo", "workflow.states.todo", WorkflowStateCategory.Todo, 0);
        _schemes.Add(scheme);
        return Task.FromResult(scheme.Uuid);
    }
}

public sealed class WorkflowStateDefinitionDto
{
    public Guid Uuid { get; set; }
    public string Code { get; set; } = string.Empty;
    public string NameKey { get; set; } = string.Empty;
    public WorkflowStateCategory Category { get; set; }
    public int OrderNo { get; set; }
}

public sealed class WorkflowTransitionDefinitionDto
{
    public Guid Uuid { get; set; }
    public Guid FromStateUuid { get; set; }
    public Guid ToStateUuid { get; set; }
    public string NameKey { get; set; } = string.Empty;
    public string? RequiredPermission { get; set; }
    public List<string> RequiredFieldCodes { get; set; } = [];
}

public interface IWorkflowStateUsageProbe
{
    Task<IReadOnlyCollection<Guid>> GetUsedStateUuidsAsync(Guid schemeUuid, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<Guid>> GetIssueUuidsInStateAsync(Guid schemeUuid, Guid stateUuid, CancellationToken cancellationToken);

    /// <summary>Stany faktycznie zajęte przez zgłoszenia <b>jednego</b> projektu. Zmiana schematu
    /// projektu pyta o to zamiast o cały schemat: projektów na jednym schemacie bywa wiele,
    /// a przestawiany jest jeden.</summary>
    Task<IReadOnlyCollection<Guid>> GetUsedStateUuidsInProjectAsync(Guid projectUuid, CancellationToken cancellationToken);
}

/// <summary>Filtr techniczny dla zadania migracji stanu po opublikowaniu schematu.</summary>
public sealed class WorkflowStateMigrationFilter
{
    public Guid SchemeUuid { get; set; }
    public Guid FromStateUuid { get; set; }
}

public sealed class WorkflowSchemeExecPublishCommandHandler : CommandHandler<WorkflowSchemeExecPublishCommand, Guid>
{
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IWorkflowStateUsageProbe _usage;
    public WorkflowSchemeExecPublishCommandHandler(IWorkflowSchemeRepository schemes, IWorkflowStateUsageProbe usage)
        => (_schemes, _usage) = (schemes, usage);

    public override async Task<Guid> ExecuteAsync(WorkflowSchemeExecPublishCommand command, CancellationToken ct = default)
    {
        var scheme = await _schemes.FindAsync(command.SchemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(WorkflowScheme), command.SchemeUuid);
        if (scheme.IsSystem)
            throw new DomainException("taskmgmt.workflow_scheme_system_readonly", "Schemat systemowy jest edytowany wyłącznie przez wdrożenie.");

        var targetStates = command.States.Select(x => x.Uuid).ToHashSet();
        var removed = scheme.States.Where(x => !targetStates.Contains(x.Uuid)).Select(x => x.Uuid).ToHashSet();
        var usedRemoved = (await _usage.GetUsedStateUuidsAsync(scheme.Uuid, ct).ConfigureAwait(false)).Where(removed.Contains).ToList();
        if (usedRemoved.Any(state => !command.RemovedStateMappings.TryGetValue(state, out var target) || !targetStates.Contains(target)))
            throw new DomainException("taskmgmt.workflow_migration_mapping_incomplete", "Każdy używany usuwany stan wymaga stanu docelowego migracji.");

        scheme.ReplaceDefinition(command.Name,
            command.States.Select(x => new WorkflowStateDefinition(x.Uuid, x.Code, x.NameKey, x.Category, x.OrderNo)).ToList(),
            command.Transitions.Select(x => new WorkflowTransitionDefinition(
                x.Uuid,
                x.FromStateUuid,
                x.ToStateUuid,
                x.NameKey,
                x.RequiredPermission,
                x.RequiredFieldCodes)).ToList());
        return scheme.Uuid;
    }
}
