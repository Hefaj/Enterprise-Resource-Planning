using Erp.BuildingBlocks.Api.Commands;
using FastEndpoints;
using TaskManagement.Application.SavedIssueViews;
using TaskManagement.Application.WorkLogs;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

public sealed class WorkLogCreateCommandEndpoint : Endpoint<WorkLogCreateCommand, Guid>
{
    private readonly ICommandDispatcher _dispatcher;
    public WorkLogCreateCommandEndpoint(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;
    public override void Configure()
    {
        Post("work-log-create");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
    }
    public override async Task HandleAsync(WorkLogCreateCommand req, CancellationToken ct)
        => await Send.OkAsync(await _dispatcher.SendAsync<WorkLogCreateCommand, Guid>(req, ct), ct);
}

public sealed class SavedIssueViewCreateCommandEndpoint : Endpoint<SavedIssueViewCreateCommand, Guid>
{
    private readonly ICommandDispatcher _dispatcher;
    public SavedIssueViewCreateCommandEndpoint(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;
    public override void Configure() { Post("saved-view-create"); Group<IssueGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(SavedIssueViewCreateCommand req, CancellationToken ct)
        => await Send.OkAsync(await _dispatcher.SendAsync<SavedIssueViewCreateCommand, Guid>(req, ct), ct);
}

public sealed class SavedIssueViewSetDefinitionCommandEndpoint : Endpoint<SavedIssueViewSetDefinitionCommand, Guid>
{
    private readonly ICommandDispatcher _dispatcher;
    public SavedIssueViewSetDefinitionCommandEndpoint(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;
    public override void Configure() { Post("saved-view-set-definition"); Group<IssueGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(SavedIssueViewSetDefinitionCommand req, CancellationToken ct)
        => await Send.OkAsync(await _dispatcher.SendAsync<SavedIssueViewSetDefinitionCommand, Guid>(req, ct), ct);
}
