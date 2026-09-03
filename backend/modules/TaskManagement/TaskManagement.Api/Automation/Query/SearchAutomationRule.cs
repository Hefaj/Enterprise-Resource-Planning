using FastEndpoints;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Query;

/// <summary>Reguły automatyzacji projektu (AUT-001).</summary>
public sealed class SearchAutomationRuleEndpoint : Endpoint<SearchAutomationRuleRequest, List<AutomationRuleDto>>
{
    private readonly IAutomationRuleQueries _queries;

    public SearchAutomationRuleEndpoint(IAutomationRuleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchAutomationRule");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
    }

    public override async Task HandleAsync(SearchAutomationRuleRequest req, CancellationToken ct)
    {
        var rules = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(rules, ct);
    }
}
