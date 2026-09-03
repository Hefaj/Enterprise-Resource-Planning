using FastEndpoints;
using TaskManagement.Application.Automation;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Automation.Query;

/// <summary>Log ostatnich uruchomień jednej reguły (AUT-002 AC1).</summary>
public sealed class GetAutomationRuleRunsRequest
{
    public Guid RuleUuid { get; set; }

    /// <summary>Domyślnie 20 — panel pod listą reguł, nie pełna historia do przeglądania.</summary>
    public int Limit { get; set; } = 20;
}

public sealed class GetAutomationRuleRunsEndpoint
    : Endpoint<GetAutomationRuleRunsRequest, List<AutomationRunDto>>
{
    private readonly IAutomationRuleQueries _queries;

    public GetAutomationRuleRunsEndpoint(IAutomationRuleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getAutomationRuleRuns");
        Group<AutomationGroup>();
        Permissions(P.TaskManagement.AutomationManage);
    }

    public override async Task HandleAsync(GetAutomationRuleRunsRequest req, CancellationToken ct)
    {
        var runs = await _queries.GetRecentRunsAsync(req.RuleUuid, Math.Clamp(req.Limit, 1, 100), ct);
        await Send.OkAsync(runs, ct);
    }
}
