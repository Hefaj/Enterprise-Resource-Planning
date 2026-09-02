using TaskManagement.Domain.Boards;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Boards;

/// <summary>Tablica w widoku odczytu — razem z kolumnami, bo bez nich nie da się narysować
/// ani jednej karty.</summary>
public sealed record BoardDto(
    Guid Uuid,
    Guid ProjectUuid,
    string Name,
    BoardMode Mode,
    bool IsDefault,
    List<BoardColumnDto> Columns,
    /// <summary>Oś grupowania wierszy (BRD-006) — <see cref="BoardSwimlaneMode.None"/> znaczy
    /// „bez swimlane'ów".</summary>
    BoardSwimlaneMode SwimlaneMode,
    string? SwimlaneFieldCode);

/// <summary>Kolumna tablicy. Stany idą listą, bo jedna kolumna może zbierać kilka stanów
/// („w toku” = <c>InProgress</c> + <c>Review</c>).</summary>
public sealed record BoardColumnDto(
    Guid Uuid,
    string Name,
    int OrderNo,
    List<Guid> StateUuids,
    /// <summary>Limit WIP (BRD-007) — sygnał wyłącznie wizualny, front nie blokuje upuszczenia
    /// karty po jego przekroczeniu.</summary>
    int? WipLimit);

/// <summary>
/// Karta na tablicy — zgłoszenie razem ze swoją pozycją.
///
/// <para><see cref="Uuid"/> to identyfikator <b>karty</b>, nie zgłoszenia: to on przychodzi
/// kanałem <c>taskmgmt.board</c> przy przestawieniu i po nim front odnajduje wiersz do
/// podmiany. <see cref="Rank"/> bywa pusty — zgłoszenie, którego nikt jeszcze nie przestawiał,
/// nie ma wiersza w <c>board_card</c> i ląduje na końcu (patrz <see cref="IBoardQueries"/>).</para>
///
/// <para>Nagłówek zgłoszenia jedzie razem z kartą jednym zapytaniem. Osobne odpytanie
/// orkiestratora zgłoszeń o kilkaset uuid-ów przy każdym otwarciu tablicy byłoby drugą podróżą
/// po dane, które i tak trzeba narysować od razu.</para>
/// </summary>
public sealed record BoardCardDto(
    Guid Uuid,
    Guid BoardUuid,
    Guid IssueUuid,
    string? Rank,
    Guid? SprintUuid,
    string Key,
    string Title,
    Guid TypeUuid,
    string TypeName,
    IssueTypeCategory TypeCategory,
    string TypeIcon,
    Guid StateUuid,
    IssuePriority Priority,
    Guid? AssigneeUuid,
    DateTimeOffset? DueAt,
    DateTimeOffset CreatedAt,
    /// <summary>Bezpośredni rodzic — podstawa swimlane'u „Epik" (BRD-006). Front rozstrzyga
    /// tytuł swimlane'u po tym uuidzie tylko wtedy, gdy tablica ma włączony ten tryb.</summary>
    Guid? ParentUuid,
    string? ParentTitle,
    /// <summary>Wartość pola niestandardowego wskazanego przez <c>Board.SwimlaneFieldCode</c> —
    /// puste, gdy tablica nie grupuje po polu własnym albo zgłoszenie nie ma wartości.</summary>
    string? SwimlaneFieldValue);

/// <summary>Żądanie listy tablic. Pusty <see cref="ProjectUuid"/> zwraca wszystkie widoczne.</summary>
public sealed class SearchBoardRequest
{
    public Guid? ProjectUuid { get; set; }
}

/// <summary>Żądanie pojedynczej tablicy razem z kolumnami.</summary>
public sealed class GetBoardRequest
{
    public Guid Uuid { get; set; }
}

/// <summary>
/// Żądanie kart tablicy.
///
/// <para><see cref="Uuids"/> ogranicza odpowiedź do wskazanych <b>kart</b> — tą ścieżką idzie
/// odświeżenie po zdarzeniu realtime, żeby przeciągnięcie jednej karty nie kazało klientowi
/// pobierać całej tablicy (<c>docs/backend/task-management.md</c> §7.4). Puste = cała tablica.</para>
/// </summary>
public sealed class GetBoardCardsRequest
{
    public Guid BoardUuid { get; set; }

    public List<Guid>? Uuids { get; set; }
}

/// <summary>Odczyty tablic. Widoczność dziedziczy po projekcie tablicy — kto nie widzi
/// projektu, nie widzi jego tablicy ani kart.</summary>
public interface IBoardQueries
{
    Task<List<BoardDto>> SearchAsync(SearchBoardRequest request, CancellationToken cancellationToken);

    Task<BoardDto?> GetAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>
    /// Karty tablicy w kolejności <c>(rank, uuid)</c>.
    ///
    /// <para><b>Zgłoszenia bez wiersza w <c>board_card</c> też wracają</b>, z pustym rankiem
    /// i na końcu. Alternatywa — zakładanie karty każdemu zgłoszeniu przy jego tworzeniu —
    /// wymagałaby zapisu do wszystkich tablic projektu w transakcji komendy zgłoszenia i i tak
    /// nie pokryłaby zgłoszeń starszych od tablicy. Wiersz powstaje przy pierwszym
    /// przestawieniu karty i od tego momentu niesie jej pozycję.</para>
    /// </summary>
    Task<List<BoardCardDto>> GetCardsAsync(GetBoardCardsRequest request, CancellationToken cancellationToken);
}
