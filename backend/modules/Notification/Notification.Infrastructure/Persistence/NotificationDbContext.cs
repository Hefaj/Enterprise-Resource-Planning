using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Notification.Domain.Jobs;

namespace Notification.Infrastructure.Persistence;

/// <summary>
/// Kontekst modułu Notification, schemat <c>notification</c>.
///
/// W przeciwieństwie do <c>CatalogDbContext</c> NIE implementuje <c>IJobDbContext</c> —
/// Notification nie wykonuje zadań masowych i nie ma tabel <c>job</c>/<c>job_item</c>.
/// Jedyna tabela to <see cref="NotificationJobs"/>, read-model karmiony zdarzeniami.
/// </summary>
public sealed class NotificationDbContext : ErpDbContext
{
    /// <summary>Nazwa schematu modułu.</summary>
    public const string SchemaName = "notification";

    public NotificationDbContext(DbContextOptions<NotificationDbContext> options) : base(options)
    {
    }

    /// <inheritdoc />
    protected override string Schema => SchemaName;

    public DbSet<NotificationJob> NotificationJobs => Set<NotificationJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NotificationDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
