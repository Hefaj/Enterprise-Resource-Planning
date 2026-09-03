using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Command;

/// <summary>Wyłącza regułę automatyzacji bez usuwania (AUT-002 AC1).</summary>
public sealed class AutomationRuleExecDisableMultipleCommandEndpoint
    : BatchEndpointBase<AutomationRuleExecDisableCommand, SearchAutomationRuleRequest>
{
    private readonly IAutomationRuleQueries _queries;

    public AutomationRuleExecDisableMultipleCommandEndpoint(IAutomationRuleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-disable");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
        Description(d => d.WithSummary("Wyłącza regułę automatyzacji"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchAutomationRuleRequest filter, CancellationToken ct)
    {
        var rules = await _queries.SearchAsync(filter, ct);
        return rules.Where(r => r.IsEnabled).Select(r => r.Uuid);
    }
}
