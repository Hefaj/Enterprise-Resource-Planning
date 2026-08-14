using Catalog.Domain.Categories;
using Catalog.Domain.Models;
using Catalog.Domain.Multimedia;
using Catalog.Domain.Products;
using Catalog.Domain.Warranties;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Persistence;

/// <summary>
/// Kontekst modułu Catalog. Mieszka w schemacie <c>catalog</c> — razem z własną tabelą historii
/// migracji i własnymi tabelami zadań masowych, bo to Catalog wykonuje operacje zbiorcze
/// na produktach i to on musi je wznowić po restarcie.
/// </summary>
public sealed class CatalogDbContext : ErpDbContext, IJobDbContext
{
    /// <summary>Nazwa schematu modułu.</summary>
    public const string SchemaName = "catalog";

    public CatalogDbContext(DbContextOptions<CatalogDbContext> options) : base(options)
    {
    }

    /// <inheritdoc />
    protected override string Schema => SchemaName;

    public DbSet<Product> Products => Set<Product>();

    public DbSet<Category> Categories => Set<Category>();

    /// <summary>Tabela domknięcia drzewa kategorii — indeks pochodny, utrzymywany przez
    /// <see cref="CategoryClosureMaintainer"/>, nie przez model domenowy.</summary>
    public DbSet<CategoryClosureEntry> CategoryClosure => Set<CategoryClosureEntry>();

    public DbSet<ProductModel> ProductModels => Set<ProductModel>();

    public DbSet<MultimediaAsset> MultimediaAssets => Set<MultimediaAsset>();

    public DbSet<Warranty> Warranties => Set<Warranty>();

    /// <inheritdoc />
    public DbSet<Job> Jobs => Set<Job>();

    /// <inheritdoc />
    public DbSet<JobItem> JobItems => Set<JobItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CatalogDbContext).Assembly);

        // Konfiguracje zadań masowych żyją w BuildingBlocks — inaczej każdy moduł
        // powielałby mapowanie tych samych dwóch tabel (i prędzej czy później je rozjechał).
        modelBuilder.ApplyConfiguration(new JobConfiguration());
        modelBuilder.ApplyConfiguration(new JobItemConfiguration());

        base.OnModelCreating(modelBuilder);
    }
}
