using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Command;

/// <summary>Nadpisuje treść reguły automatyzacji (AUT-001).</summary>
public sealed class AutomationRuleSetMultipleCommandEndpoint
    : BatchEndpointBase<AutomationRuleSetCommand, SearchAutomationRuleRequest>
{
    private readonly IAutomationRuleQueries _queries;

    public AutomationRuleSetMultipleCommandEndpoint(IAutomationRuleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
        Description(d => d.WithSummary("Nadpisuje regułę automatyzacji"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchAutomationRuleRequest filter, CancellationToken ct)
    {
        var rules = await _queries.SearchAsync(filter, ct);
        return rules.Select(r => r.Uuid);
    }
}
