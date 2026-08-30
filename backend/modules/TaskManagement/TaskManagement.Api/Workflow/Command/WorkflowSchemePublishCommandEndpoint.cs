using Erp.BuildingBlocks.Api.Commands;
using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Publikuje pełną definicję schematu po walidacji mapowania usuwanych stanów.</summary>
public sealed class WorkflowSchemePublishCommandEndpoint : Endpoint<WorkflowSchemePublishCommand, Guid>
{
    private readonly ICommandDispatcher _dispatcher;
    public WorkflowSchemePublishCommandEndpoint(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;
    public override void Configure()
    {
        Post("publish");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
    }
    public override async Task HandleAsync(WorkflowSchemePublishCommand req, CancellationToken ct)
        => await Send.OkAsync(await _dispatcher.SendAsync<WorkflowSchemePublishCommand, Guid>(req, ct), ct);
}
