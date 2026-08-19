using Erp.BuildingBlocks.Persistence;
using Identity.Domain.Audit;
using Identity.Domain.Roles;
using Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Persistence;

/// <summary>
/// Kontekst modułu Identity, schemat <c>identity</c>. Bez <c>IJobDbContext</c> — inaczej niż
/// Catalog/Sales, Identity NIE ma dziś operacji masowych (zarządzanie rolami to niskowolumenowe
/// akcje administracyjne, patrz <c>RoleCommands.cs</c>); dopisanie go jest tanie, gdy pojawi się
/// pierwszy realny przypadek (np. masowe nadanie roli filtrowi użytkowników).
/// </summary>
public sealed class IdentityDbContext : ErpDbContext
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}
