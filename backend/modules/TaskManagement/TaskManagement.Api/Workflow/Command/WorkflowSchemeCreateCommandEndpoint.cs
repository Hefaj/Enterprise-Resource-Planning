using Erp.BuildingBlocks.Api.Commands;
using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

public sealed class WorkflowSchemeCreateCommandEndpoint : Endpoint<WorkflowSchemeCreateCommand, Guid>
{
    private readonly ICommandDispatcher _dispatcher;
    public WorkflowSchemeCreateCommandEndpoint(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;
    public override void Configure() { Post("create"); Group<WorkflowGroup>(); Permissions(P.TaskManagement.SchemeManage); }
    public override async Task HandleAsync(WorkflowSchemeCreateCommand req, CancellationToken ct) => await Send.OkAsync(await _dispatcher.SendAsync<WorkflowSchemeCreateCommand, Guid>(req, ct), ct);
}
