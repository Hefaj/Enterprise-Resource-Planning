using System.Reflection;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;
using Wolverine.RabbitMQ;

namespace Erp.BuildingBlocks.Messaging;

/// <summary>
/// Rejestracja warstwy komunikatów — jedno miejsce dla wszystkich mikroserwisów,
/// żeby konfiguracja outboxu nie rozjechała się między modułami.
/// </summary>
public static class ErpMessagingExtensions
{
    /// <summary>
    /// Konfiguruje Wolverine'a: transport RabbitMQ, trwałość outbox/inbox na Postgresie
    /// i integrację transakcji z EF Core.
    /// </summary>
    /// <typeparam name="TContext">Kontekst modułu, z którego transakcją ma być spięty outbox.</typeparam>
    /// <param name="builder">Builder hosta.</param>
    /// <param name="consumerAssemblies">Zestawy skanowane w poszukiwaniu handlerów komunikatów.
    /// Zwykle jeden — projekt <c>Infrastructure</c> modułu; więcej niż jeden, gdy część
    /// konsumentów wymaga zależności dostępnych dopiero w warstwie <c>Api</c>
    /// (np. Notification: przekaźnik do SignalR potrzebuje <c>IHubContext</c>, którego
    /// Infrastructure nie może referencować bez złamania kierunku zależności).</param>
    public static IHostApplicationBuilder AddErpMessaging<TContext>(
        this IHostApplicationBuilder builder,
        params Assembly[] consumerAssemblies)
        where TContext : ErpDbContext
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentNullException.ThrowIfNull(consumerAssemblies);

        if (consumerAssemblies.Length == 0)
        {
            throw new ArgumentException("Wymagany co najmniej jeden zestaw do skanowania.", nameof(consumerAssemblies));
        }

        var options = builder.Configuration
            .GetSection(ErpMessagingOptions.SectionName)
            .Get<ErpMessagingOptions>() ?? new ErpMessagingOptions();

        Validate(options);

        builder.Services.AddSingleton(options);

        builder.UseWolverine(wolverine =>
        {
            wolverine.ServiceName = options.ServiceName;

            foreach (var assembly in consumerAssemblies)
            {
                wolverine.Discovery.IncludeAssembly(assembly);
            }

            // Outbox/inbox w Postgresie, w schemacie osobnym od schematów modułów.
            wolverine.PersistMessagesWithPostgresql(
                options.PostgresConnectionString,
                options.MessagingSchema);

            // Pozwala Wolverine'owi dopisać koperty do transakcji EF Core tego samego DbContextu.
            wolverine.UseEntityFrameworkCoreTransactions();

            var rabbit = wolverine.UseRabbitMq(new Uri(options.RabbitMqConnectionString));

            if (options.AutoProvision)
            {
                // Lokalnie wygodne; na produkcji kolejki i wymiany zakłada kontrolowany deployment,
                // żeby aplikacja nie potrzebowała uprawnień do zmiany topologii brokera.
                rabbit.AutoProvision();
            }

            // Zdarzenia integracyjne są kontraktem publicznym i jako jedyne wychodzą na brokera.
            // Routing po przestrzeni nazw zamiast po pojedynczych typach: nowy kontrakt dodany
            // do Erp.BuildingBlocks.Contracts jest publikowalny od razu, bez dopisywania go tutaj —
            // czyli bez klasy błędu „dodałem event, a on nigdzie nie leci”.
            wolverine.Publish(x =>
            {
                x.MessagesFromAssemblyContaining<Contracts.AggregateChanged>();
                x.ToRabbitExchange("erp.events");
            });

            // Konsument: własna trwała kolejka związana z fanoutową wymianą `erp.events`.
            // BindExchange deklaruje topologię (kolejka + powiązanie), ListenToRabbitQueue
            // każe Wolverine'owi faktycznie z niej czytać — bez tego drugiego wywołania
            // kolejka by istniała, ale nikt by jej nie konsumował.
            if (!string.IsNullOrWhiteSpace(options.ListenQueueName))
            {
                rabbit.BindExchange("erp.events", Wolverine.RabbitMQ.ExchangeType.Fanout)
                    .ToQueue(options.ListenQueueName);

                wolverine.ListenToRabbitQueue(options.ListenQueueName);
            }
        });

        // Outbox jest per DbContext — publisher musi trzymać ten sam kontekst co jednostka pracy.
        builder.Services.AddScoped<IIntegrationEventPublisher, WolverineIntegrationEventPublisher<TContext>>();
        builder.Services.AddScoped<IUnitOfWork, ErpUnitOfWork<TContext>>();

        return builder;
    }

    private static void Validate(ErpMessagingOptions options)
    {
        // Brak konfiguracji ma się objawić przy starcie, a nie przy pierwszej komendzie
        // w godzinach szczytu — dlatego twardo, tutaj.
        if (string.IsNullOrWhiteSpace(options.ServiceName))
        {
            throw new InvalidOperationException(
                $"Brak `{ErpMessagingOptions.SectionName}:{nameof(ErpMessagingOptions.ServiceName)}` w konfiguracji.");
        }

        if (string.IsNullOrWhiteSpace(options.RabbitMqConnectionString))
        {
            throw new InvalidOperationException(
                $"Brak `{ErpMessagingOptions.SectionName}:{nameof(ErpMessagingOptions.RabbitMqConnectionString)}` w konfiguracji.");
        }

        if (string.IsNullOrWhiteSpace(options.PostgresConnectionString))
        {
            throw new InvalidOperationException(
                $"Brak `{ErpMessagingOptions.SectionName}:{nameof(ErpMessagingOptions.PostgresConnectionString)}` w konfiguracji.");
        }
    }
}
