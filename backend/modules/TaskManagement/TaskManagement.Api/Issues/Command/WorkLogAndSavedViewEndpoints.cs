using Erp.BuildingBlocks.Api.Commands;
using FastEndpoints;
using TaskManagement.Application.Issues;
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

public sealed class SavedIssueViewUpdateCommandEndpoint : Endpoint<SavedIssueViewUpdateCommand, Guid>
{
    private readonly ICommandDispatcher _dispatcher;
    public SavedIssueViewUpdateCommandEndpoint(ICommandDispatcher dispatcher) => _dispatcher = dispatcher;
    public override void Configure() { Post("saved-view-update"); Group<IssueGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(SavedIssueViewUpdateCommand req, CancellationToken ct)
        => await Send.OkAsync(await _dispatcher.SendAsync<SavedIssueViewUpdateCommand, Guid>(req, ct), ct);
}
