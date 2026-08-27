using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Application.Projects;

/// <summary>Podpina albo odpina schemat pól projektu.</summary>
public sealed class ProjectSetFieldSchemeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    /// <summary>Pusty odpina schemat. Wartości zapisane na zgłoszeniach zostają
    /// (<see cref="Project.SetFieldScheme"/>).</summary>
    public Guid? FieldSchemeUuid { get; set; }
}

public sealed class ProjectSetFieldSchemeCommandHandler : CommandHandler<ProjectSetFieldSchemeCommand, Guid>
{
    private readonly IProjectRepository _projects;
    private readonly IFieldSchemeRepository _schemes;

    public ProjectSetFieldSchemeCommandHandler(IProjectRepository projects, IFieldSchemeRepository schemes)
    {
        _projects = projects;
        _schemes = schemes;
    }

    public override async Task<Guid> ExecuteAsync(ProjectSetFieldSchemeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var project = await _projects.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.Uuid);

        if (command.FieldSchemeUuid is { } schemeUuid && schemeUuid != Guid.Empty)
        {
            _ = await _schemes.FindAsync(schemeUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(FieldScheme), schemeUuid);
        }

        project.SetFieldScheme(command.FieldSchemeUuid);

        return project.Uuid;
    }
}
