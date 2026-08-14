using Erp.BuildingBlocks.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>Rejestracja silnika zadań masowych w module.</summary>
public static class ErpBulkJobsExtensions
{
    /// <summary>
    /// Podpina <see cref="BulkCommandRunner{TContext}"/> i konfigurację zadań.
    ///
    /// Same <see cref="IBulkCommandExecutor"/> rejestruje moduł osobno — silnik nie ma
    /// (i nie powinien mieć) wiedzy o tym, jakie komendy istnieją w danej domenie.
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
        services.AddHostedService<BulkCommandRunner<TContext>>();

        return services;
    }
}
