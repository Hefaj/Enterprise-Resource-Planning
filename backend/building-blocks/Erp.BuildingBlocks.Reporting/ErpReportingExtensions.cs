using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Reporting;

/// <summary>Rejestracja podsystemu raportowego w module — mirror <c>ErpBulkJobsExtensions</c>.</summary>
public static class ErpReportingExtensions
{
    /// <summary>
    /// Podpina <see cref="ReportRunner{TContext}"/> i <see cref="IReportJobFactory"/>.
    ///
    /// <para>Same implementacje <see cref="IReportDefinition"/> rejestruje <c>AddErpModule</c>
    /// ze skanu zestawów modułu — ten silnik nie ma (i nie powinien mieć) wiedzy o tym, jakie
    /// raporty istnieją w danej domenie.</para>
    ///
    /// <para>Rejestracja jest jawna w <c>Program.cs</c> modułu (jak przy
    /// <c>AddErpBulkJobs</c>), bo niesie decyzję o cyklu życia usługi hostowanej — konwencja
    /// skanowania świadomie tego nie robi.</para>
    /// </summary>
    /// <typeparam name="TContext">Kontekst modułu z tabelami <c>report_run</c>/<c>job</c>.</typeparam>
    public static IServiceCollection AddErpReporting<TContext>(this IServiceCollection services)
        where TContext : ErpDbContext, IJobDbContext, IReportRunDbContext
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IReportJobFactory, ReportJobFactory<TContext>>();
        services.AddHostedService<ReportRunner<TContext>>();

        return services;
    }
}
