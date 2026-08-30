using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

public sealed class IssueMigrateWorkflowStateMultipleCommandEndpoint : BatchEndpointBase<IssueMigrateWorkflowStateCommand, WorkflowStateMigrationFilter>
{
    private readonly IWorkflowStateUsageProbe _usage;
    public IssueMigrateWorkflowStateMultipleCommandEndpoint(IWorkflowStateUsageProbe usage) => _usage = usage;
    public override void Configure()
    {
        Post("batch-migrate-workflow-state");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.SchemeManage);
    }
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(WorkflowStateMigrationFilter filter, CancellationToken ct)
        => await _usage.GetIssueUuidsInStateAsync(filter.SchemeUuid, filter.FromStateUuid, ct);
}
