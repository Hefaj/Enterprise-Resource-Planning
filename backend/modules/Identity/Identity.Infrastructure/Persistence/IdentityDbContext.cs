using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Identity.Domain.Audit;
using Identity.Domain.Roles;
using Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Persistence;

/// <summary>
/// Kontekst modułu Identity, schemat <c>identity</c>. Od Fazy 0 przejścia na operacje masowe
/// (patrz <c>docs/backend/identity-bulk-migration.md</c>) implementuje <see cref="IJobDbContext"/>
/// tak samo jak Catalog/Sales — tabele <c>job</c>/<c>job_item</c> żyją w tym schemacie, bo to
/// Identity wykonuje własne zadania i musi je wznowić po restarcie.
/// </summary>
public sealed class IdentityDbContext : ErpDbContext, IJobDbContext
{
    /// <summary>Nazwa schematu modułu.</summary>
    public const string SchemaName = "identity";

    public IdentityDbContext(DbContextOptions<IdentityDbContext> options) : base(options)
    {
    }

    /// <inheritdoc />
    protected override string Schema => SchemaName;

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();

    public DbSet<PermissionCatalogEntry> PermissionCatalogEntries => Set<PermissionCatalogEntry>();

    public DbSet<GrantAuditEntry> GrantAuditEntries => Set<GrantAuditEntry>();

    /// <inheritdoc />
    public DbSet<Job> Jobs => Set<Job>();

    /// <inheritdoc />
    public DbSet<JobItem> JobItems => Set<JobItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);

        // Konfiguracje zadań masowych żyją w BuildingBlocks — inaczej każdy moduł
        // powielałby mapowanie tych samych dwóch tabel (i prędzej czy później je rozjechał).
        modelBuilder.ApplyConfiguration(new JobConfiguration());
        modelBuilder.ApplyConfiguration(new JobItemConfiguration());

        base.OnModelCreating(modelBuilder);
    }
}
