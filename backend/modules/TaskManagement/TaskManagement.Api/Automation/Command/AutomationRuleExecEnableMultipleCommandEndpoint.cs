using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Command;

/// <summary>Włącza regułę automatyzacji bez zmiany treści (AUT-002 AC1).</summary>
public sealed class AutomationRuleExecEnableMultipleCommandEndpoint
    : BatchEndpointBase<AutomationRuleExecEnableCommand, SearchAutomationRuleRequest>
{
    private readonly IAutomationRuleQueries _queries;

    public AutomationRuleExecEnableMultipleCommandEndpoint(IAutomationRuleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-enable");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
        Description(d => d.WithSummary("Włącza regułę automatyzacji"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchAutomationRuleRequest filter, CancellationToken ct)
    {
        var rules = await _queries.SearchAsync(filter, ct);
        return rules.Where(r => !r.IsEnabled).Select(r => r.Uuid);
    }
}
