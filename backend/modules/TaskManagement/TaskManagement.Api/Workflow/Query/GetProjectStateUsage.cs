using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

/// <summary>
/// Które stany są zajęte przez zgłoszenia projektu. Karta projektu pyta o to przed przestawieniem
/// schematu stanów: bez tego nie wie, dla których stanów musi zebrać mapowanie, a komenda
/// odrzuciłaby zmianę bez powiedzenia, czego brakuje.
/// </summary>
public sealed class GetProjectStateUsageEndpoint : Endpoint<GetProjectStateUsageRequest, ProjectStateUsageDto>
{
    private readonly IWorkflowStateUsageProbe _usage;

    public GetProjectStateUsageEndpoint(IWorkflowStateUsageProbe usage) => _usage = usage;

    public override void Configure()
    {
        Post("getProjectStateUsage");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
    }

    public override async Task HandleAsync(GetProjectStateUsageRequest req, CancellationToken ct)
        => await Send.OkAsync(new ProjectStateUsageDto(req.ProjectUuid, [.. await _usage.GetUsedStateUuidsInProjectAsync(req.ProjectUuid, ct)]), ct);
}
