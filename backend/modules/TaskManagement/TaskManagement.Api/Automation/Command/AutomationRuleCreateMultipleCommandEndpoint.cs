using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Command;

/// <summary>Zakłada regułę automatyzacji (AUT-001).</summary>
public sealed class AutomationRuleCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<AutomationRuleCreateCommand, SearchAutomationRuleRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
        Description(d => d.WithSummary("Zakłada regułę automatyzacji"));
    }
}
