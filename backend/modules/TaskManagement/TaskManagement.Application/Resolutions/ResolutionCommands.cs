using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Resolutions;

namespace TaskManagement.Application.Resolutions;

/// <summary>Dokłada rozwiązanie własne projektu obok czterech systemowych (ISS-007) — nigdy
/// systemowe, te powstają wyłącznie z seeda (<see cref="ResolutionDefaults"/>).</summary>
public sealed class ResolutionCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public int OrderNo { get; set; }
}

public sealed class ResolutionCreateCommandHandler : CommandHandler<ResolutionCreateCommand, Guid>
{
    private readonly IResolutionRepository _resolutions;

    public ResolutionCreateCommandHandler(IResolutionRepository resolutions) => _resolutions = resolutions;

    public override Task<Guid> ExecuteAsync(ResolutionCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var resolution = Resolution.CreateWithUuid(
            command.Uuid, command.ProjectUuid, command.Name, nameKey: null, isSystem: false, command.OrderNo);

        _resolutions.Add(resolution);

        return Task.FromResult(resolution.Uuid);
    }
}
