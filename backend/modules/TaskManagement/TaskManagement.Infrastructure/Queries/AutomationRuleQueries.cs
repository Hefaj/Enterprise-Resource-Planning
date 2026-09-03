using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Automation;
using TaskManagement.Domain.Automation;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty reguł automatyzacji (AUT-001/AUT-002).</summary>
public sealed class AutomationRuleQueries : IAutomationRuleQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public AutomationRuleQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<List<AutomationRuleDto>> SearchAsync(
        SearchAutomationRuleRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var rules = await _dbContext.AutomationRules
            .AsNoTracking()
            .Include(r => r.Actions)
            .Where(r => r.ProjectUuid == request.ProjectUuid)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (rules.Count == 0)
        {
            return [];
        }

        var ruleUuids = rules.Select(r => r.Uuid).ToList();

        // Jedno zapytanie zbiorcze zamiast N — licznik wykonań (AUT-002 AC1) dla całej listy
        // reguł projektu naraz.
        var executedCounts = await _dbContext.AutomationRuns
            .AsNoTracking()
            .Where(run => ruleUuids.Contains(run.RuleUuid) && run.Outcome == AutomationRunOutcome.Executed)
            .GroupBy(run => run.RuleUuid)
            .Select(g => new { RuleUuid = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.RuleUuid, g => g.Count, cancellationToken)
            .ConfigureAwait(false);

        return rules.ConvertAll(rule => ToDto(rule, executedCounts.GetValueOrDefault(rule.Uuid)));
    }

    /// <inheritdoc />
    public async Task<List<AutomationRunDto>> GetRecentRunsAsync(
        Guid ruleUuid, int limit, CancellationToken cancellationToken)
        => await _dbContext.AutomationRuns
            .AsNoTracking()
            .Where(run => run.RuleUuid == ruleUuid)
            .OrderByDescending(run => run.OccurredAt)
            .Take(limit)
            .Select(run => new AutomationRunDto(
                run.Uuid, run.RuleUuid, run.IssueUuid, run.Outcome, run.ErrorMessage, run.OccurredAt))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    private static AutomationRuleDto ToDto(AutomationRule rule, int executedCount)
        => new(
            rule.Uuid,
            rule.ProjectUuid,
            rule.Name,
            rule.TriggerKind,
            AutomationConditionSerializer.Deserialize(rule.ConditionJson).Groups,
            rule.Actions
                .OrderBy(a => a.OrderNo)
                .Select(a => new AutomationActionDto(a.Uuid, a.Kind, a.ConfigJson, a.OrderNo))
                .ToList(),
            rule.IsEnabled,
            executedCount,
            rule.CreatedAt);
}
