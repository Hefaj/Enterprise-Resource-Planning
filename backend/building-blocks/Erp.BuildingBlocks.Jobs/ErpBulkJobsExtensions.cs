using Erp.BuildingBlocks.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>Rejestracja silnika zadań masowych w module.</summary>
public static class ErpBulkJobsExtensions
{
    /// <summary>
    /// Podpina <see cref="BulkCommandRunner{TContext}"/>, magazyn zadań i konfigurację.
    ///
    /// Same <see cref="IBulkCommandExecutor"/> rejestruje <c>AddErpModule</c> ze skanu zestawów
    /// modułu — silnik nie ma (i nie powinien mieć) wiedzy o tym, jakie komendy istnieją
    /// w danej domenie.
    /// </summary>
    /// <typeparam name="TContext">Kontekst modułu z tabelami <c>job</c>/<c>job_item</c>.</typeparam>
    public static IServiceCollection AddErpBulkJobs<TContext>(
        this IServiceCollection services,
        IConfiguration configuration)
        where TContext : ErpDbContext, IJobDbContext
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<BulkJobOptions>(configuration.GetSection(BulkJobOptions.SectionName));

        // Singleton na proces — dokładnie jeden runner tego kontekstu żyje w procesie, więc
        // jeden budzik na proces w zupełności wystarcza (patrz IJobQueueSignal). Rejestracja
        // idzie tutaj, a nie w Program.cs, z tego samego powodu co JobStore niżej: moduł nie
        // ma tu wyboru do podjęcia.
        services.AddSingleton<IJobQueueSignal, JobQueueSignal>();
        services.AddHostedService<BulkCommandRunner<TContext>>();

        // Magazyn zadań jest zawsze tą samą parą co runner — moduł nie ma tu żadnego wyboru
        // do podjęcia, więc rejestracja idzie razem z silnikiem, a nie jako osobna linijka
        // w Program.cs, którą można pominąć przy zakładaniu kolejnego mikroserwisu.
        services.AddScoped<IJobStore, JobStore<TContext>>();

        // Elementy zadania wstawia binarne COPY — patrz IJobItemBulkWriter. Scoped, bo pisze
        // po połączeniu tego samego DbContextu, na którym zakładany jest nagłówek zadania.
        services.AddScoped<IJobItemBulkWriter, PostgresJobItemBulkWriter<TContext>>();

        // Wyłączność runnera na zadaniu. Scoped, bo nazwy tabeli i kolumn czyta z modelu EF
        // tego kontekstu, a blokuje po JEGO połączeniu — musi więc żyć w tym samym scope
        // co transakcja chunka.
        services.AddScoped<JobQueueLock<TContext>>();

        return services;
    }
}
