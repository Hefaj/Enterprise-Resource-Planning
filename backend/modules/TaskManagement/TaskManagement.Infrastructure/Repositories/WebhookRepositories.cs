using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Webhooks;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium webhooków wychodzących (faza 8, API-004).</summary>
public sealed class WebhookRepository : IWebhookRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public WebhookRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Webhook?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Webhooks.FirstOrDefaultAsync(w => w.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<Webhook>> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken)
        => await _dbContext.Webhooks
            .Where(w => w.ProjectUuid == projectUuid)
            .OrderBy(w => w.CreatedAt)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    /// <inheritdoc />
    public void Add(Webhook webhook) => _dbContext.Webhooks.Add(webhook);

    /// <inheritdoc />
    public void Remove(Webhook webhook) => _dbContext.Webhooks.Remove(webhook);
}

/// <summary>Repozytorium dostarczeń webhooka.</summary>
public sealed class WebhookDeliveryRepository : IWebhookDeliveryRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public WebhookDeliveryRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<WebhookDelivery?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.WebhookDeliveries.FirstOrDefaultAsync(d => d.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(WebhookDelivery delivery) => _dbContext.WebhookDeliveries.Add(delivery);
}
