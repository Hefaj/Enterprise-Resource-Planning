namespace Erp.BuildingBlocks.Messaging;

/// <summary>Konfiguracja warstwy komunikatów, wiązana z sekcji <c>Messaging</c> w appsettings.</summary>
public sealed class ErpMessagingOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "Messaging";

    /// <summary>Nazwa serwisu widoczna w nagłówkach komunikatów i w logach — ułatwia
    /// prześledzenie, kto wyprodukował zdarzenie. Zwykle nazwa modułu, np. <c>Catalog</c>.</summary>
    public string ServiceName { get; set; } = string.Empty;

    /// <summary>Łańcuch połączenia do RabbitMQ (AMQP), np. <c>amqp://erp:erp@localhost:5672</c>.</summary>
    public string RabbitMqConnectionString { get; set; } = string.Empty;

    /// <summary>Łańcuch połączenia do Postgresa, w którym Wolverine trzyma outbox/inbox.</summary>
    public string PostgresConnectionString { get; set; } = string.Empty;

    /// <summary>
    /// Schemat na tabele trwałości Wolverine'a. Celowo osobny od schematów modułów
    /// (<c>catalog</c>, <c>notification</c>) — tabele outboxu to infrastruktura, nie model domenowy,
    /// i nie mają wpadać w migracje modułu ani w jego zrzut schematu.
    /// </summary>
    public string MessagingSchema { get; set; } = "wolverine";

    /// <summary>
    /// Czy Wolverine ma sam zakładać kolejki i wymiany w RabbitMQ. Wygodne lokalnie,
    /// na produkcji zwykle wyłączone na rzecz kontrolowanego provisioningu.
    /// </summary>
    public bool AutoProvision { get; set; }

    /// <summary>
    /// Nazwa własnej, trwałej kolejki serwisu związanej z fanoutową wymianą <c>erp.events</c>
    /// — jeśli podana, serwis staje się konsumentem zdarzeń integracyjnych, a nie tylko
    /// producentem. Każdy konsument ma WŁASNĄ kolejkę (fanout kopiuje wiadomość do każdej
    /// związanej kolejki), więc kilku konsumentów nigdy nie rywalizuje o tę samą wiadomość.
    ///
    /// <c>null</c> (domyślnie) — serwis wyłącznie publikuje, tak jak dziś Catalog.
    /// Ustawione — jak w Notification, które musi odebrać <c>AggregateChanged</c>/<c>Job*</c>,
    /// żeby zasilić replikę i rozgłosić je dalej przez SignalR.
    /// </summary>
    public string? ListenQueueName { get; set; }
}
