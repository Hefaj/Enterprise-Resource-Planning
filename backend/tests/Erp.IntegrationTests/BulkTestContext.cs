using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.IntegrationTests;

/// <summary>
/// Agregat testowy z <b>licznikiem wykonań</b>.
///
/// <para>Licznik, a nie flaga „zrobione": kryterium akceptacji z
/// <c>docs/backend/multi-instance.md</c> §10 wymaga wykazania, że żaden element nie został
/// wykonany <b>dwukrotnie</b>. Flaga idempotentna nie odróżniłaby jednego wykonania od dwóch,
/// a <c>job_item.attempts</c> liczy próby runnera, nie faktyczne skutki uboczne w danych —
/// czyli mierzyłby to, co sam runner o sobie sądzi.</para>
/// </summary>
internal sealed class TouchCounter : AggregateRoot
{
    private TouchCounter()
    {
    }

    public TouchCounter(Guid uuid) : base(uuid)
    {
    }

    public int Touches { get; private set; }

    public void Touch() => Touches++;
}

/// <summary>
/// Kontekst dla testów silnika zadań: tabele <c>job</c>/<c>job_item</c> plus agregat z licznikiem.
///
/// <para><b>Dlaczego własny kontekst, a nie <c>CatalogDbContext</c>.</b>
/// <see cref="BulkCommandRunner{TContext}"/> jest generyczny po module i nie wie nic o produktach —
/// testowanie go na Catalogu dorzucałoby do dowodu cały łańcuch migracji, seedów i handlerów
/// domenowych, których ten test nie sprawdza. Kontekst zbudowany pod ten jeden mechanizm mierzy
/// dokładnie ten mechanizm.</para>
/// </summary>
internal sealed class BulkTestDbContext : ErpDbContext, IJobDbContext
{
    private readonly string _schema;

    public BulkTestDbContext(DbContextOptions<BulkTestDbContext> options, string schema) : base(options)
        => _schema = schema;

    protected override string Schema => _schema;

    /// <summary>Schemat tego kontekstu — czyta go <see cref="SchemaAwareModelCacheKeyFactory"/>.</summary>
    public string SchemaName => _schema;

    public DbSet<Job> Jobs => Set<Job>();

    public DbSet<JobItem> JobItems => Set<JobItem>();

    public DbSet<TouchCounter> Counters => Set<TouchCounter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new JobConfiguration());
        modelBuilder.ApplyConfiguration(new JobItemConfiguration());
        modelBuilder.Entity<TouchCounter>().ToTable("touch_counter");

        base.OnModelCreating(modelBuilder);
    }
}

/// <summary>
/// Wpuszcza schemat do klucza cache'u modelu EF.
///
/// <para>Bez tego wszystkie testy dzielą JEDEN model: EF cache'uje go po typie kontekstu, więc
/// drugi test dostawał model zbudowany dla schematu pierwszego i po cichu pisał do cudzych tabel.
/// Objawiało się to fałszywym „już istnieje" przy tworzeniu tabel i — groźniej — testem, który
/// przechodził, mierząc dane innego testu.</para>
///
/// <para>W produkcji problem nie istnieje, bo schemat modułu jest stały przez cały czas życia
/// procesu; to koszt izolacji testów przez schematy, nie obejście wady.</para>
/// </summary>
internal sealed class SchemaAwareModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime)
        => (context.GetType(), (context as BulkTestDbContext)?.SchemaName, designTime);
}

/// <summary>
/// Egzekutor testowy — odpowiednik <c>ProductSetPriceCommandHandler</c> sprowadzony do jednego
/// obserwowalnego skutku. Nie zapisuje sam; <c>SaveChanges</c> woła runner raz na chunk, tak samo
/// jak dla egzekutorów produkcyjnych.
/// </summary>
internal sealed class TouchExecutor : IBulkCommandExecutor
{
    public const string Command = "TouchCommand";

    private readonly BulkTestDbContext _dbContext;

    public TouchExecutor(BulkTestDbContext dbContext) => _dbContext = dbContext;

    public string CommandType => Command;

    public async Task ExecuteAsync(Guid aggregateUuid, string? commandJson, CancellationToken cancellationToken)
    {
        var counter = await _dbContext.Counters
            .FirstAsync(c => c.Uuid == aggregateUuid, cancellationToken)
            .ConfigureAwait(false);

        counter.Touch();
    }
}

/// <summary>
/// Publisher zastępczy: zapisuje kontekst, nie dotykając brokera.
///
/// <para>Nie jest to atrapa „nic nie robię" — <c>SaveChangesAndFlushAsync</c> musi faktycznie
/// zapisać, bo na tym stoi cała granica transakcji chunka. Różnica względem produkcji jest jedna
/// i jest tu istotna: Wolverine po zapisie <b>sam zatwierdza</b> bieżącą transakcję, a ten
/// publisher tego nie robi — więc test przechodzi ścieżką, w której transakcję domyka runner
/// (<c>CommitAsync</c> sprawdzające <c>CurrentTransaction</c>).</para>
/// </summary>
internal sealed class DirectSavePublisher : IIntegrationEventPublisher
{
    private readonly BulkTestDbContext _dbContext;

    public DirectSavePublisher(BulkTestDbContext dbContext) => _dbContext = dbContext;

    public Task PublishAsync(object integrationEvent, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task PublishAllAsync(IEnumerable<object> integrationEvents, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task SaveChangesAndFlushAsync(CancellationToken cancellationToken = default)
        => _dbContext.SaveChangesAsync(cancellationToken);
}

/// <summary>
/// Buduje kontener DI odpowiadający <b>jednej instancji serwisu</b>.
///
/// <para>Dwa wywołania dają dwa niezależne kontenery nad tą samą bazą — i to jest cała sztuczka
/// tych testów: dwie instancje różnią się w interesujący nas sposób wyłącznie tym, że nie dzielą
/// niczego w pamięci procesu. Pula połączeń, ChangeTracker i singletony są osobne, dokładnie jak
/// przy dwóch procesach.</para>
/// </summary>
internal static class BulkTestInstance
{
    public static ServiceProvider Build(
        string connectionString, string schema, Action<IServiceCollection>? configureExtra = null)
    {
        var services = new ServiceCollection();

        services.AddLogging();

        services.AddDbContext<BulkTestDbContext>((_, options) =>
            options
                .UseErpPostgres(connectionString, schema)
                .ReplaceService<IModelCacheKeyFactory, SchemaAwareModelCacheKeyFactory>(),
            ServiceLifetime.Scoped);

        services.AddScoped(sp => new BulkTestDbContext(
            sp.GetRequiredService<DbContextOptions<BulkTestDbContext>>(), schema));

        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<MutableExecutionContext>();
        services.AddScoped<IExecutionContext>(sp => sp.GetRequiredService<MutableExecutionContext>());

        // Pusta mapa sygnatur: agregat testowy nie jest synchronizowany do klientów, więc skan
        // ChangeTrackera nie produkuje `AggregateChanged` i nie ma czego publikować.
        services.AddSingleton<IAggregateSignatureMap>(new AggregateSignatureMap());

        services.AddScoped<IIntegrationEventPublisher, DirectSavePublisher>();
        services.AddScoped<IUnitOfWork, ErpUnitOfWork<BulkTestDbContext>>();
        services.AddScoped<Erp.BuildingBlocks.Application.Commands.CommandTransactionScope>();
        services.AddScoped<JobQueueLock<BulkTestDbContext>>();
        services.AddKeyedScoped<IBulkCommandExecutor, TouchExecutor>(TouchExecutor.Command);
        services.AddSingleton<IJobQueueSignal, JobQueueSignal>();

        services.Configure<BulkJobOptions>(options =>
        {
            // Mały chunk celowo: przy 5 tys. elementów daje kilkadziesiąt commitów, czyli
            // kilkadziesiąt okazji, żeby dwa runnery weszły sobie w drogę. Duży chunk
            // zamykałby zadanie w dwóch transakcjach i test niczego by nie sprawdził.
            options.ChunkSize = 100;
            options.MinChunkSize = 100;
            options.ProgressUpdateTarget = 1;
            options.IdlePollingInterval = TimeSpan.FromMilliseconds(50);
        });

        configureExtra?.Invoke(services);

        return services.BuildServiceProvider();
    }
}
