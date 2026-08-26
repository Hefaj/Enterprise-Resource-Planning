using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Erp.BuildingBlocks.Persistence.Concurrency;

/// <summary>Rejestracja dzierżawy wyłączności dla modułu.</summary>
public static class ErpExclusiveLeaseExtensions
{
    /// <summary>
    /// Podpina <see cref="IExclusiveLease"/> opartą o advisory locki Postgresa.
    ///
    /// <para>Idzie razem z rejestracją <c>DbContext</c> modułu, bo stamtąd bierze łańcuch
    /// połączenia. <c>TryAdd</c>, więc powtórne wywołanie (pipeline komend woła to samo)
    /// jest nieszkodliwe.</para>
    /// </summary>
    /// <typeparam name="TContext">Kontekst modułu.</typeparam>
    /// <param name="services">Kolekcja usług.</param>
    public static IServiceCollection AddErpExclusiveLease<TContext>(this IServiceCollection services)
        where TContext : ErpDbContext
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddScoped<IExclusiveLease, PostgresExclusiveLease<TContext>>();

        return services;
    }
}
