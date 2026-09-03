using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Command;

/// <summary>Usuwa regułę automatyzacji.</summary>
public sealed class AutomationRuleRemoveMultipleCommandEndpoint
    : BatchEndpointBase<AutomationRuleRemoveCommand, SearchAutomationRuleRequest>
{
    private readonly IAutomationRuleQueries _queries;

    public AutomationRuleRemoveMultipleCommandEndpoint(IAutomationRuleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
        Description(d => d.WithSummary("Usuwa regułę automatyzacji"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchAutomationRuleRequest filter, CancellationToken ct)
    {
        var rules = await _queries.SearchAsync(filter, ct);
        return rules.Select(r => r.Uuid);
    }
}
