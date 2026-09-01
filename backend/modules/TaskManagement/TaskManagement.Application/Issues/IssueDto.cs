using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>Zgłoszenie w widoku odczytu. Kategoria stanu jedzie razem ze stanem, bo to po niej
/// front decyduje o kolorze i o tym, czy karta „wyszła z pracy” — bez niej musiałby doładowywać
/// schemat, żeby narysować listę. Typ jedzie tą samą drogą, z tego samego powodu: kolumna typu
/// na liście i ikona na karcie nie mogą doładowywać schematu typów osobnym zapytaniem.</summary>
public sealed record IssueDto(
    Guid Uuid,
    Guid ProjectUuid,
    string ProjectCode,
    string Key,
    string Title,
    string? Description,
    IssuePriority Priority,
    Guid TypeUuid,
    string TypeName,
    IssueTypeCategory TypeCategory,
    string TypeIcon,
    Guid StateUuid,
    string StateCode,
    string StateNameKey,
    WorkflowStateCategory StateCategory,
    Guid ReporterUuid,
    Guid? AssigneeUuid,
    DateTimeOffset? DueAt,
    Guid? ParentUuid,
    bool IsRestricted,
    /// <summary>Wyliczony stan realizacji zlecenia (REQ-003) — <c>None</c> dla zgłoszeń,
    /// które nie są zleceniem.</summary>
    IssueDeliveryState DerivedDeliveryState,
    /// <summary>Czy bieżący użytkownik aktywnie obserwuje — przełącznik „obserwuję" na karcie
    /// czyta to pole, zamiast doładowywać całą listę obserwatorów.</summary>
    bool IsWatchedByMe,
    int WatcherCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    Dictionary<string, string> CustomFields);

/// <summary>
/// Zakres listy zgłoszeń — <b>parametr, nie osobna strona</b>. „Moje zgłoszenia” jako oddzielny
/// ekran zmusza użytkownika do zgadywania, gdzie patrzeć
/// (<c>docs/frontend/task-management-pages.md</c> §2.1).
/// </summary>
public enum IssueScope
{
    /// <summary>Wszystko, co użytkownik ma prawo zobaczyć.</summary>
    Available = 0,

    /// <summary>Przypisane do mnie.</summary>
    AssignedToMe = 1,

    /// <summary>Zgłoszone przeze mnie.</summary>
    ReportedByMe = 2,
}

/// <summary>
/// Filtr po polu niestandardowym.
///
/// <para>Działa <b>wyłącznie na polach ze slotem</b> i wyłącznie w kontekście jednego projektu:
/// bez projektu nie da się przetłumaczyć kodu pola na slot, bo dwa schematy mogą mapować ten
/// sam kod na różne kolumny. Pole spoza profilu jest <b>ignorowane</b>, nie odrzucane —
/// tak samo jak nieznane pole sortowania (<c>docs/backend/cqrs.md</c>).</para>
/// </summary>
public sealed class IssueCustomFieldFilter
{
    /// <summary>Kod pola z profilu projektu.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Wartość w postaci kanonicznej. Dla tekstu dopasowanie jest częściowe
    /// (<c>ILIKE</c>), dla liczby, daty i użytkownika — dokładne.</summary>
    public string Value { get; set; } = string.Empty;
}

/// <summary>Filtry wyszukiwania zgłoszeń.</summary>
public sealed class SearchIssueRequest : PagedRequest
{
    /// <summary>
    /// Zakres listy; puste = <see cref="IssueScope.Available"/>.
    ///
    /// <para><b>Nullowalne celowo</b>, jak każde inne pole tego filtra. Formularz filtrów na
    /// froncie wysyła <c>null</c> dla pól, których użytkownik nie tknął — przy nienullowalnym
    /// enumie deserializacja wywala się na <c>null</c> zanim żądanie w ogóle dojdzie do handlera,
    /// więc „Wyszukaj" bez ustawionego zakresu kończyło się błędem 400.</para>
    /// </summary>
    public IssueScope? Scope { get; set; }

    /// <summary>Kontekst projektu — dopiero on odblokowuje kolumny projekto-specyficzne (faza 3).</summary>
    public Guid? ProjectUuid { get; set; }

    /// <summary>Szukanie po tytule <b>oraz po kluczu</b>, w tym po kluczach historycznych.</summary>
    public string? Text { get; set; }

    public Guid? StateUuid { get; set; }

    public WorkflowStateCategory? StateCategory { get; set; }

    public IssuePriority? Priority { get; set; }

    public Guid? AssigneeUuid { get; set; }

    /// <summary>
    /// Filtry po polach niestandardowych. Wymagają ustawionego <see cref="ProjectUuid"/> —
    /// bez niego są pomijane w całości, bo kod pola nie ma jak zamienić się w slot.
    /// </summary>
    public List<IssueCustomFieldFilter>? CustomFields { get; set; }

    /// <summary>
    /// Tryb drzewa: stronicowanie idzie po <b>zgłoszeniach bez rodzica</b>, a odpowiedź niesie
    /// dodatkowo całe ich poddrzewa, w kolejności drzewa.
    ///
    /// <para>Potomkowie wracają <b>niezależnie od pozostałych filtrów</b> i to jest świadome:
    /// drzewo z wyciętymi gałęziami nie jest drzewem, a użytkownik, który filtruje po „moje"
    /// i włącza tryb drzewa, chce zobaczyć swoje epiki z całą zawartością — nie epiki z jednym
    /// podzadaniem, które akurat też jest jego. <c>totalCount</c> liczy korzenie, bo to one
    /// są jednostką stronicowania.</para>
    /// </summary>
    public bool TreeMode { get; set; }
}

/// <summary>Pobranie zgłoszeń po identyfikatorach.</summary>
public sealed class GetIssueRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Pobranie zgłoszenia po kluczu czytelnym — trasa karty idzie po <c>DEV-412</c>,
/// nie po UUID.</summary>
public sealed class GetIssueByKeyRequest
{
    public string Key { get; set; } = string.Empty;
}

/// <summary>Odczyty zgłoszeń. Implementacja w <c>TaskManagement.Infrastructure</c>.</summary>
public interface IIssueQueries
{
    Task<SearchResponse> SearchAsync(SearchIssueRequest request, CancellationToken cancellationToken);

    Task<List<IssueDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>Zwraca zgłoszenie po kluczu bieżącym albo historycznym. <c>null</c>, gdy klucza
    /// nie ma albo użytkownik nie ma do zgłoszenia dostępu — rozróżnianie tych dwóch przypadków
    /// w odpowiedzi zdradzałoby istnienie zgłoszeń z projektów, których nie widać.</summary>
    Task<IssueDto?> GetByKeyAsync(string key, CancellationToken cancellationToken);

    /// <summary>Identyfikatory pasujące do filtra, bez stronicowania — zbiór celów operacji masowej.</summary>
    Task<List<Guid>> GetMatchingUuidsAsync(SearchIssueRequest request, CancellationToken cancellationToken);
}
