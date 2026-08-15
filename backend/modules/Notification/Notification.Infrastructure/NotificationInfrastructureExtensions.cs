using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Notification.Application.Jobs;
using Notification.Domain.Jobs;
using Notification.Infrastructure.Persistence;
using Notification.Infrastructure.Queries;

namespace Notification.Infrastructure;

/// <summary>Rejestracja warstwy infrastruktury modułu Notification.</summary>
public static class NotificationInfrastructureExtensions
{
    /// <summary>Nazwa wpisu z łańcuchem połączenia w sekcji <c>ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "NotificationDb";

    public static IServiceCollection AddNotificationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Brak łańcucha połączenia `ConnectionStrings:{ConnectionStringName}` w konfiguracji.");

        services.AddDbContext<NotificationDbContext>(options => options.UseErpPostgres(
            connectionString,
            NotificationDbContext.SchemaName,
            typeof(NotificationDbContext).Assembly.GetName().Name));

        services.AddScoped<IJobQueries, JobQueries>();
        services.AddHostedService<ErpDatabaseMigrator<NotificationDbContext>>();

        // Jedyny agregat modułu widoczny dla klientów przez SignalR — dzięki temu każda
        // aktualizacja repliki (patrz Consumers/JobReplicationHandlers) automatycznie generuje
        // AggregateChanged na sygnaturze `notification.job`, bez ręcznego wywołania w handlerze.
        services.AddSingleton<IAggregateSignatureMap>(
            new AggregateSignatureMap().Register<NotificationJob>(AggregateSignatures.NotificationJob));

        return services;
    }
}
