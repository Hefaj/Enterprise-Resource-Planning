namespace Erp.BuildingBlocks.Contracts;

/// <summary>Status zadania masowego. Kolejność wartości jest częścią kontraktu — nie przenumerowywać.</summary>
public enum JobStatus
{
    /// <summary>Przyjęte, czeka na wykonanie.</summary>
    Pending = 0,

    /// <summary>W trakcie — część chunków przetworzona.</summary>
    Running = 1,

    /// <summary>Zakończone, wszystkie elementy powiodły się.</summary>
    Completed = 2,

    /// <summary>Zakończone, ale część elementów zawiodła (sukces częściowy jest dozwolony).</summary>
    CompletedWithErrors = 3,

    /// <summary>Nie udało się wykonać w ogóle (np. błąd infrastrukturalny przed pierwszym chunkiem).</summary>
    Failed = 4,

    /// <summary>Anulowane przez użytkownika.</summary>
    Cancelled = 5,

    /// <summary>
    /// Zadanie w trakcie zakładania — nagłówek już jest w bazie, ale jego elementy mogą jeszcze
    /// nie być kompletne. <b>Stan wewnętrzny właściciela zadania, nigdy nie opuszcza modułu.</b>
    ///
    /// <para>Istnieje, bo elementy zadania wstawia binarne <c>COPY</c>, którego nie da się
    /// wykonać w tej samej transakcji co koperta <c>JobAccepted</c> (outbox Wolverine'a zapisuje
    /// kopertę dopiero razem z jej wypchnięciem). Zamiast poświęcać atomowość, zakładanie zostało
    /// rozbite na dwa kroki: najpierw nagłówek w tym stanie plus elementy, potem JEDNO atomowe
    /// przełączenie na <see cref="Pending"/> razem z kopertą.</para>
    ///
    /// <para>Runner podejmuje wyłącznie <see cref="Pending"/> i <see cref="Running"/>, więc
    /// zadanie w tym stanie jest dla niego niewidzialne; klient nie dostaje <c>jobUuid</c>, dopóki
    /// przełączenie się nie powiedzie. Awaria w trakcie zakładania zostawia więc osierocony wiersz
    /// — nikt go nie zobaczy i nikt go nie wykona, ale nikt go też dziś nie sprząta
    /// (patrz <c>docs/backend/bulk-commands.md</c> §3).</para>
    ///
    /// <para>Wartość dopisana na KOŃCU wyliczenia — kolejność pozostałych jest częścią kontraktu
    /// zapisanego w <c>job.status</c> jako liczba.</para>
    /// </summary>
    Draft = 6,
}

/// <summary>
/// Zadanie masowe zostało przyjęte i utrwalone. Publikowane przez serwis wykonujący (np. Catalog)
/// w tej samej transakcji, w której powstały wiersze <c>job</c>/<c>job_item</c>.
///
/// Notification zakłada na tej podstawie wiersz repliki read-modelu w schemacie <c>notification</c>,
/// dzięki czemu frontendowe <c>searchJob</c>/<c>getJob</c> działają bez zmiany kontraktu i bez
/// odpytywania serwisu wykonującego. Właścicielem zadania pozostaje serwis, który je wykonuje —
/// Notification ma wyłącznie kopię do odczytu.
/// </summary>
/// <param name="JobUuid">Identyfikator zadania; jest jednocześnie <c>trackingID</c> zwróconym
/// na frontend w <c>BatchResult.JobUuid</c> i rejestrowanym w <c>JobService</c>.</param>
/// <param name="QueueId">Identyfikator wywołującego (zwykle modalu) — frontend grupuje po nim zadania.</param>
/// <param name="CommandType">Nazwa typu komendy, np. <c>SetProductPriceCommand</c>.</param>
/// <param name="CommandJson">Serializowana komenda-szablon — do podglądu i do retry.</param>
/// <param name="TotalCount">Liczba elementów objętych zadaniem.</param>
/// <param name="UserId">Właściciel zadania — decyduje, do której grupy SignalR trafią powiadomienia.</param>
/// <param name="ClientId">Identyfikator klienta/połączenia, jeśli znany.</param>
/// <param name="UiMetadata">Nieprzezroczysty dla backendu blob z frontendu (klucz tłumaczenia komendy itp.).</param>
/// <param name="ExpireOn">Moment wygaśnięcia zadania.</param>
/// <param name="OccurredAt">Moment przyjęcia (UTC).</param>
public sealed record JobAccepted(
    Guid JobUuid,
    string? QueueId,
    string CommandType,
    string? CommandJson,
    int TotalCount,
    string? UserId,
    string? ClientId,
    string? UiMetadata,
    DateTimeOffset? ExpireOn,
    DateTimeOffset OccurredAt);

/// <summary>
/// Postęp zadania po zatwierdzeniu kolejnego chunka. Emitowane raz na chunk, nie raz na element —
/// przy 50 tys. elementów i chunku 500 daje to 100 zdarzeń zamiast 50 tys.
/// </summary>
/// <param name="JobUuid">Identyfikator zadania.</param>
/// <param name="Succeeded">Liczba elementów zakończonych powodzeniem do tej pory.</param>
/// <param name="Failed">Liczba elementów zakończonych błędem do tej pory.</param>
/// <param name="Total">Łączna liczba elementów.</param>
/// <param name="OccurredAt">Moment pomiaru (UTC).</param>
public sealed record JobProgressed(
    Guid JobUuid,
    int Succeeded,
    int Failed,
    int Total,
    DateTimeOffset OccurredAt);

/// <summary>
/// Zadanie dobiegło końca. To zdarzenie zamyka pętlę na frontendzie: <c>JobService</c> oznacza
/// rekord jako <c>isComplete</c>, a użytkownik dostaje powiadomienie.
/// </summary>
/// <param name="JobUuid">Identyfikator zadania.</param>
/// <param name="Status">Status końcowy — <see cref="JobStatus.Completed"/>,
/// <see cref="JobStatus.CompletedWithErrors"/>, <see cref="JobStatus.Failed"/>
/// lub <see cref="JobStatus.Cancelled"/>.</param>
/// <param name="Succeeded">Liczba elementów zakończonych powodzeniem.</param>
/// <param name="Failed">Liczba elementów zakończonych błędem.</param>
/// <param name="ErrorsSummary">Podsumowanie błędów zgrupowane po <c>ErrorCode</c>
/// (np. <c>"price_negative: 1200; aggregate_not_found: 3"</c>) — celowo NIE lista 1203 komunikatów.
/// Szczegóły per element zostają w <c>job_item</c> u właściciela zadania.</param>
/// <param name="OccurredAt">Moment zakończenia (UTC).</param>
public sealed record JobCompleted(
    Guid JobUuid,
    JobStatus Status,
    int Succeeded,
    int Failed,
    string? ErrorsSummary,
    DateTimeOffset OccurredAt);
