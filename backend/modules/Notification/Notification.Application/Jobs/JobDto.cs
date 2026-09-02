using Notification.Domain.Jobs;

namespace Notification.Application.Jobs;

// Kształt tego rekordu generuje przez NSwag klienta TypeScript, na którym stoi
// NotificationJobOrchestrator (frontend/libs/modules/notification/data-access) i feed powiadomień
// w nagłówku klienta. Zmiana pola = świadoma regeneracja klienta, nie przypadkowe przemianowanie.
//
// Poprzednia wersja odziedziczyła kształt po mocku sprzed wdrożenia realnych zadań
// (ResultJson, ResultType, Exceptions, ExecutionTimes, ServiceId, UnRead, Successes) — pola te
// nie miały pokrycia w modelu zdarzeń i wracały jako stałe null/0/true. Zostały usunięte,
// a nie utrzymywane „na wszelki wypadek”: kontrakt, który kłamie o tym, co wie backend,
// jest gorszy niż kontrakt węższy.

/// <summary>Zadanie masowe w widoku odczytu Notification (replika).</summary>
/// <param name="Uuid">Identyfikator zadania; jednocześnie <c>trackingID</c> znany frontendowi
/// z <c>BatchResult.JobUuid</c>.</param>
/// <param name="QueueId">Identyfikator wywołującego (zwykle modalu) — front grupuje po nim zadania.</param>
/// <param name="TrackingId">Tekstowa kopia <paramref name="Uuid"/>, po której idzie wyszukiwanie częściowe.</param>
/// <param name="CommandType">Nazwa typu komendy, np. <c>ProductSetPriceCommand</c> — fallbackowy
/// opis zadania, gdy front nie przekazał własnych metadanych w <paramref name="UiMetadata"/>.</param>
/// <param name="CommandJson">Serializowana komenda-szablon — do podglądu i do ponowienia.</param>
/// <param name="UiMetadata">Nieprzezroczysty dla backendu blob z frontendu (klucz tłumaczenia
/// komendy, kontekst modalu) — to z niego front buduje czytelny opis wiersza powiadomienia.</param>
/// <param name="Status">Status końcowy lub bieżący — rozróżnia „zakończone z błędami”,
/// „nie ruszyło” i „anulowane”, czego <paramref name="IsComplete"/> nie potrafi.</param>
/// <param name="TotalCount">Liczba elementów objętych zadaniem — mianownik paska postępu.</param>
/// <param name="SucceededCount">Elementy zakończone powodzeniem do tej pory.</param>
/// <param name="FailedCount">Elementy zakończone błędem do tej pory.</param>
/// <param name="IsComplete">Skrót dla filtra „tylko trwające” — patrz <c>SearchJobRequest.IsComplete</c>.</param>
/// <param name="ErrorsSummary">Błędy zgrupowane po kodzie (np. <c>"price_negative: 1200"</c>),
/// celowo nie lista komunikatów per element.</param>
/// <param name="UserId">Zleceniodawca, jeśli znany.</param>
/// <param name="ClientId">Karta przeglądarki, która zleciła zadanie — dziś podstawowy
/// identyfikator odbiorcy powiadomień, dopóki nie ma uwierzytelniania.</param>
/// <param name="CreatedAt">Moment przyjęcia zadania.</param>
/// <param name="ExpireOn">Moment wygaśnięcia, jeśli ustawiony.</param>
/// <param name="ResultRef">Referencja do wytworzonego artefaktu — <b>identyfikator, nie adres</b>.
/// Dla raportu/eksportu jest to uuid przebiegu, z którym klient idzie po krótko ważny link do
/// pobrania (<c>catalog: reportRun/getReportRunDownloadUrl</c>). Adres nigdy nie jedzie tędy: jest
/// bearer-owy i ważny minuty, więc leżałby w cache długo po tym, jak przestał być potrzebny.</param>
///
/// <remarks>
/// Znaczniki czasu są typu <see cref="DateTimeOffset"/>, tak jak w encji — spłaszczanie ich
/// do <c>DateTime</c> w projekcji wymagało konwersji (<c>ExpireOn.Value.UtcDateTime</c>),
/// której EF Core nie potrafi przetłumaczyć dla wartości nullowalnej i która wywracała
/// <c>getJob</c> błędem 500. Klient TypeScript i tak dostaje z NSwaga <c>Date</c>, więc
/// kontrakt po stronie frontendu się przez to nie zmienia.
/// </remarks>
public sealed record JobDto(
    Guid Uuid,
    string? QueueId,
    string TrackingId,
    string CommandType,
    string? CommandJson,
    string? UiMetadata,
    NotificationJobStatus Status,
    int TotalCount,
    int SucceededCount,
    int FailedCount,
    bool IsComplete,
    string? ErrorsSummary,
    string? UserId,
    string? ClientId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpireOn,
    string? ResultRef);
