using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Sales.Domain.Customers;

namespace Sales.Infrastructure.Persistence;

/// <summary>
/// Kontekst modułu Sales, schemat <c>sales</c>. Implementuje <see cref="IJobDbContext"/>
/// tak samo jak <c>CatalogDbContext</c> — Sales też wykonuje własne operacje masowe
/// (<c>batch-set-name</c> na klientach), więc potrzebuje własnych tabel <c>job</c>/<c>job_item</c>
/// do ich wznawiania po restarcie. To jest właśnie sedno tego modułu: udowodnić, że ten sam
/// wzorzec działa bez modyfikacji w BuildingBlocks.
/// </summary>
public sealed class SalesDbContext : ErpDbContext, IJobDbContext
{
    /// <summary>Nazwa schematu modułu.</summary>
    public const string SchemaName = "sales";

    public SalesDbContext(DbContextOptions<SalesDbContext> options) : base(options)
    {
    }

    /// <inheritdoc />
    protected override string Schema => SchemaName;

    public DbSet<Customer> Customers => Set<Customer>();

    /// <inheritdoc />
    public DbSet<Job> Jobs => Set<Job>();

    /// <inheritdoc />
    public DbSet<JobItem> JobItems => Set<JobItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SalesDbContext).Assembly);

        modelBuilder.ApplyConfiguration(new JobConfiguration());
        modelBuilder.ApplyConfiguration(new JobItemConfiguration());

        base.OnModelCreating(modelBuilder);
    }
}
