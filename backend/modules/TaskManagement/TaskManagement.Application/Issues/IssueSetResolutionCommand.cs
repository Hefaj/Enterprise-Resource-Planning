using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Ustawia rozwiązanie zgłoszenia (ISS-007) — osobna komenda od
/// <see cref="IssueSetCustomFieldsCommand"/>, bo rozwiązanie jest polem pierwszej klasy
/// (<c>Issue.ResolutionUuid</c>), nie pozycją w <c>custom_fields</c>.
/// </summary>
public sealed class IssueSetResolutionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? ResolutionUuid { get; set; }
}

public sealed class IssueSetResolutionCommandHandler : CommandHandler<IssueSetResolutionCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IResolutionRepository _resolutions;
    private readonly IClock _clock;

    public IssueSetResolutionCommandHandler(
        IIssueRepository issues,
        IResolutionRepository resolutions,
        IClock clock)
    {
        _issues = issues;
        _resolutions = resolutions;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetResolutionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        if (command.ResolutionUuid is { } resolutionUuid)
        {
            var resolution = await _resolutions.FindAsync(resolutionUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Domain.Resolutions.Resolution), resolutionUuid);

            if (resolution.ProjectUuid is { } scopedProject && scopedProject != issue.ProjectUuid)
            {
                throw new DomainException(
                    "taskmgmt.resolution_other_project",
                    "Rozwiązanie należy do innego projektu.");
            }
        }

        issue.SetResolution(command.ResolutionUuid, _clock.UtcNow);

        return issue.Uuid;
    }
}
