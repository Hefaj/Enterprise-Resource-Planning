using System.Reflection;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Messaging;
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
    /// <summary>Wymiana dla komunikatów, które mają dotrzeć do KAŻDEJ instancji KAŻDEGO serwisu.</summary>
    /// <remarks>Osobna od <c>erp.events</c>, a nie ta sama z innym powiązaniem — patrz
    /// <see cref="PermissionsInvalidated"/>. Wpięcie kolejki per instancja do <c>erp.events</c>
    /// dałoby każdej instancji komplet zdarzeń domenowych, czyli handlery odpalane dwukrotnie:
    /// raz z kolejki serwisu, raz z kolejki instancji.</remarks>
    public const string BroadcastExchange = "erp.broadcast";

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

            // Handlery fundamentu (broadcast unieważnień) — moduł nie musi o nich pamiętać.
            wolverine.Discovery.IncludeAssembly(typeof(ErpMessagingExtensions).Assembly);

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

            ConfigureBroadcast(wolverine, rabbit, options);
        });

        // Outbox jest per DbContext — publisher musi trzymać ten sam kontekst co jednostka pracy.
        builder.Services.AddScoped<IIntegrationEventPublisher, WolverineIntegrationEventPublisher<TContext>>();
        builder.Services.AddScoped<IUnitOfWork, ErpUnitOfWork<TContext>>();

        return builder;
    }

    /// <summary>
    /// Podpina kanał broadcastu: publikację na <see cref="BroadcastExchange"/> i <b>własną kolejkę
    /// tej instancji</b> związaną z tą wymianą.
    ///
    /// <para><b>Kolejka per instancja, nie per serwis</b> — to jest cała różnica względem
    /// <c>options.ListenQueueName</c>. Nazwana kolejka serwisu robi z instancji <i>competing
    /// consumers</i>: komunikat dostaje jedna z nich. Unieważnienie cache'u musi dotrzeć do
    /// wszystkich, więc każda instancja deklaruje swoją.</para>
    ///
    /// <para><b>Kolejka jest nietrwała i auto-delete</b>, więc znika razem z instancją i nie
    /// zostawia śmieci w brokerze. Trwałość byłaby tu wręcz szkodliwa: komunikat czekający na
    /// nieistniejącą już instancję unieważniałby cache, którego nie ma, a kolejka rosłaby bez
    /// konsumenta. Świadomie <b>nie</b> ustawiamy <c>exclusive</c> — auto-delete załatwia
    /// sprzątanie, a wyłączność wiąże kolejkę z konkretnym połączeniem AMQP i potrafi się wywrócić
    /// na <c>RESOURCE_LOCKED</c>, gdy Wolverine deklaruje topologię innym połączeniem niż nasłuch.</para>
    ///
    /// <para><b>Utrata komunikatu nie jest awarią.</b> Sygnał skraca czas reakcji z 60 s (TTL)
    /// do sekundy; jego zgubienie cofa system do TTL, czyli do zachowania sprzed tej zmiany.</para>
    /// </summary>
    private static void ConfigureBroadcast(
        WolverineOptions wolverine,
        Wolverine.RabbitMQ.Internal.RabbitMqTransportExpression rabbit,
        ErpMessagingOptions options)
    {
        wolverine.PublishMessage<PermissionsInvalidated>().ToRabbitExchange(BroadcastExchange);

        // Identyfikator instancji, nie nazwa hosta: dwa procesy tego samego serwisu na jednej
        // maszynie (a tak wygląda dev z profilem wieloinstancyjnym) muszą dostać różne kolejki.
        var queueName = $"{options.ServiceName.ToLowerInvariant()}.broadcast.{Guid.NewGuid():N}";

        rabbit.BindExchange(BroadcastExchange, Wolverine.RabbitMQ.ExchangeType.Fanout)
            .ToQueue(queueName, queue =>
            {
                queue.IsDurable = false;
                queue.AutoDelete = true;
            });

        wolverine.ListenToRabbitQueue(queueName);
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
