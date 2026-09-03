using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Webhooks;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty webhooków (API-004).</summary>
public sealed class WebhookQueries : IWebhookQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public WebhookQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<List<WebhookDto>> SearchAsync(SearchWebhookRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var webhooks = await _dbContext.Webhooks
            .AsNoTracking()
            .Where(w => w.ProjectUuid == request.ProjectUuid)
            .OrderBy(w => w.CreatedAt)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return webhooks.ConvertAll(w => new WebhookDto(
            w.Uuid, w.ProjectUuid, w.Url, w.EventKinds, w.IsEnabled, w.ConsecutiveFailureCount, w.CreatedAt));
    }

    /// <inheritdoc />
    public async Task<List<WebhookDeliveryDto>> GetRecentDeliveriesAsync(
        Guid webhookUuid, int limit, CancellationToken cancellationToken)
        => await _dbContext.WebhookDeliveries
            .AsNoTracking()
            .Where(d => d.WebhookUuid == webhookUuid)
            .OrderByDescending(d => d.CreatedAt)
            .Take(limit)
            .Select(d => new WebhookDeliveryDto(
                d.Uuid, d.WebhookUuid, d.IssueUuid, d.EventKind, d.Status, d.AttemptCount, d.LastError, d.CreatedAt))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
}
