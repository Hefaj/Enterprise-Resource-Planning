using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Projects;

/// <summary>
/// Założenie projektu. Razem z projektem powstaje jego licznik numeracji — jedno bez drugiego
/// nie ma sensu, a rozdzielenie na dwie komendy dawałoby okno, w którym projekt istnieje,
/// ale nie da się w nim utworzyć zgłoszenia (<c>docs/backend/task-management.md</c> §4).
/// </summary>
public sealed class ProjectCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tryb <c>Commands[]</c>.</summary>
    public Guid Uuid { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public ProjectKind Kind { get; set; } = ProjectKind.Delivery;

    /// <summary>Schemat stanów; puste = schemat systemowy modułu.</summary>
    public Guid? WorkflowSchemeUuid { get; set; }

    public bool IsPublic { get; set; }
}

public sealed class ProjectCreateCommandHandler : CommandHandler<ProjectCreateCommand, Guid>
{
    private readonly IProjectRepository _repository;
    private readonly IWorkflowSchemeRepository _schemes;
    private readonly IProjectKeyCounterWriter _counters;

    public ProjectCreateCommandHandler(
        IProjectRepository repository,
        IWorkflowSchemeRepository schemes,
        IProjectKeyCounterWriter counters)
    {
        _repository = repository;
        _schemes = schemes;
        _counters = counters;
    }

    public override async Task<Guid> ExecuteAsync(ProjectCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var schemeUuid = command.WorkflowSchemeUuid ?? WorkflowSchemeDefaults.DefaultSchemeUuid(command.Kind);

        var scheme = await _schemes.FindAsync(schemeUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Workflow.WorkflowScheme), schemeUuid);

        var project = Project.CreateWithUuid(
            command.Uuid,
            command.Code,
            command.Name,
            command.Kind,
            scheme.Uuid,
            command.IsPublic);

        _repository.Add(project);
        _counters.Add(ProjectKeyCounter.Create(project.Uuid, project.Code));

        return project.Uuid;
    }
}

public sealed class ProjectSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class ProjectSetNameCommandHandler : CommandHandler<ProjectSetNameCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectSetNameCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.SetName(command.Name);

        return project.Uuid;
    }
}

/// <summary>Ustawia politykę SLA projektu; wartości są w minutach, a <c>null/null</c> usuwa
/// politykę, gdy projekt przestaje podlegać SLA.</summary>
public sealed class ProjectSetSlaPolicyCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public int? ResponseMinutes { get; set; }
    public int? ResolutionMinutes { get; set; }
}

public sealed class ProjectSetSlaPolicyCommandHandler : CommandHandler<ProjectSetSlaPolicyCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectSetSlaPolicyCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectSetSlaPolicyCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        if (command.ResponseMinutes is null && command.ResolutionMinutes is null)
        {
            project.ClearSlaPolicy();
        }
        else
        {
            project.SetSlaPolicy(command.ResponseMinutes, command.ResolutionMinutes);
        }

        return project.Uuid;
    }
}

/// <summary>Nadanie roli w projekcie — <b>atrybut nadania</b>, nie kod uprawnienia (§10.2).</summary>
public sealed class ProjectAddMemberCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid UserUuid { get; set; }

    public ProjectMemberRole Role { get; set; } = ProjectMemberRole.Contributor;
}

public sealed class ProjectAddMemberCommandHandler : CommandHandler<ProjectAddMemberCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectAddMemberCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectAddMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.AddMember(command.UserUuid, command.Role);

        return project.Uuid;
    }
}

public sealed class ProjectRemoveMemberCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid UserUuid { get; set; }
}

public sealed class ProjectRemoveMemberCommandHandler : CommandHandler<ProjectRemoveMemberCommand, Guid>
{
    private readonly IProjectRepository _repository;

    public ProjectRemoveMemberCommandHandler(IProjectRepository repository) => _repository = repository;

    public override async Task<Guid> ExecuteAsync(ProjectRemoveMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        project.RemoveMember(command.UserUuid);

        return project.Uuid;
    }
}
