using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Notification.Application.Jobs;
using Notification.Application.UserNotifications;
using Notification.Domain.Jobs;
using Notification.Domain.UserNotifications;
using Notification.Infrastructure.Persistence;
using Notification.Infrastructure.Queries;
using Notification.Infrastructure.Realtime;

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

        // Dzierżawa wyłączności idzie razem z kontekstem, bo z niego bierze łańcuch
        // połączenia. Korzystają z niej usługi tła i praca startowa modułu —
        // patrz docs/architecture/multi-instance.md §3.1.
        services.AddErpExclusiveLease<NotificationDbContext>();

        services.AddScoped<IJobQueries, JobQueries>();
        services.AddScoped<IUserNotificationQueries, UserNotificationQueries>();
        services.AddScoped<IUserNotificationCommands, UserNotificationCommands>();

        // Trwały licznik sekwencji realtime — czytany przez hub przy Subscribe, zwiększany przez
        // przekaźnik. Po rozdzieleniu ról te dwie strony mogą chodzić w różnych procesach, więc
        // licznik musi żyć w bazie, a nie w pamięci (patrz SignatureSequence).
        services.AddScoped<ISignatureSequenceStore, PostgresSignatureSequenceStore>();
        services.AddHostedService<ErpDatabaseMigrator<NotificationDbContext>>();

        // Jedyny agregat modułu widoczny dla klientów przez SignalR — dzięki temu każda
        // aktualizacja repliki (patrz Consumers/JobReplicationHandlers) automatycznie generuje
        // AggregateChanged na sygnaturze `notification.job`, bez ręcznego wywołania w handlerze.
        services.AddSingleton<IAggregateSignatureMap>(
            new AggregateSignatureMap().Register<NotificationJob>(AggregateSignatures.NotificationJob));

        // `UserNotification` NIE dostaje sygnatury — rozgłoszenie idzie kanałem `notifications`
        // (uuid + licznik nieprzeczytanych, patrz UserNotificationRequestedConsumer), celowo poza
        // konwencją `agg:{signature}` i bez koalescencji RealtimeBroadcastera
        // (docs/modules/notification/user-notifications.md §7).

        return services;
    }
}
