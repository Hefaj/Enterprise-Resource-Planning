using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Automation;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium reguł automatyzacji (faza 8, AUT-001).</summary>
public sealed class AutomationRuleRepository : IAutomationRuleRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public AutomationRuleRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<AutomationRule?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.AutomationRules
            .Include(r => r.Actions)
            .FirstOrDefaultAsync(r => r.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<AutomationRule>> FindEnabledByTriggerAsync(
        Guid projectUuid, AutomationTriggerKind triggerKind, CancellationToken cancellationToken)
        => await _dbContext.AutomationRules
            .Include(r => r.Actions)
            .Where(r => r.ProjectUuid == projectUuid && r.TriggerKind == triggerKind && r.IsEnabled)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    /// <inheritdoc />
    public void Add(AutomationRule rule) => _dbContext.AutomationRules.Add(rule);

    /// <inheritdoc />
    public void Remove(AutomationRule rule) => _dbContext.AutomationRules.Remove(rule);
}

/// <summary>Zapis logu uruchomień reguły (AUT-002 AC1).</summary>
public sealed class AutomationRunWriter : IAutomationRunWriter
{
    private readonly TaskManagementDbContext _dbContext;

    public AutomationRunWriter(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public void Add(AutomationRun run) => _dbContext.AutomationRuns.Add(run);
}
