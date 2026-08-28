using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Powiązanie w widoku odczytu — razem z <b>nagłówkiem</b> drugiego zgłoszenia.
///
/// <para>Nagłówek (klucz, tytuł, stan, kategoria) jedzie razem z krawędzią, bo pasek powiązań
/// na karcie musi go narysować od razu. To także jedyne, co widzi ktoś bez dostępu do tamtego
/// projektu — „wgląd z powiązania" z §10.1 obejmuje nagłówek, nie opis i nie komentarze.</para>
///
/// <para><see cref="IsOutgoing"/> rozstrzyga stronę: ta sama krawędź jest „blokuje" u źródła
/// i „blokowane przez" u celu. W bazie jest jednym wierszem, więc front nie ma jak tego
/// wyliczyć bez tej flagi.</para>
/// </summary>
public sealed record IssueLinkDto(
    Guid Uuid,
    Guid IssueUuid,
    Guid OtherIssueUuid,
    IssueLinkType Type,
    bool IsOutgoing,
    string OtherKey,
    string OtherTitle,
    Guid OtherStateUuid,
    string OtherStateNameKey,
    WorkflowStateCategory OtherStateCategory);

/// <summary>Nagłówek dziecka w hierarchii — pasek „podzadania" na karcie.</summary>
public sealed record IssueChildDto(
    Guid Uuid,
    string Key,
    string Title,
    Guid StateUuid,
    string StateNameKey,
    WorkflowStateCategory StateCategory,
    Guid? AssigneeUuid);

/// <summary>Żądanie powiązań i hierarchii zgłoszenia.</summary>
public sealed class GetIssueGraphRequest
{
    public Guid IssueUuid { get; set; }
}

/// <summary>Powiązania i hierarchia zgłoszenia w jednej odpowiedzi — pasek powiązań na karcie
/// rysuje się z niej w całości, bez trzech osobnych żądań.</summary>
public sealed record IssueGraphDto(
    Guid IssueUuid,
    IssueChildDto? Parent,
    List<IssueChildDto> Children,
    List<IssueLinkDto> Links);

/// <summary>
/// Odczyty grafu zgłoszeń: hierarchia i powiązania.
///
/// <para>Pytania o osiągalność idą <b>rekurencyjnym CTE w bazie</b>, nie wczytaniem grafu do
/// pamięci: graf zależności w dużym projekcie potrafi mieć tysiące krawędzi, a reguła musi
/// działać także w pre-checku operacji masowej (<c>docs/backend/task-management.md</c> §8.2).
/// To jest ta jedna rzecz, którą robimy inaczej niż <c>RoleGraphCycleRule</c> w Identity, gdzie
/// graf ról jest o rzędy wielkości mniejszy.</para>
/// </summary>
public interface IIssueGraphQueries
{
    Task<IssueGraphDto> GetGraphAsync(Guid issueUuid, CancellationToken cancellationToken);

    /// <summary>Przodkowie każdego ze wskazanych zgłoszeń (w górę po <c>parent_uuid</c>).
    /// Klucz mapy to zgłoszenie z zapytania, wartość — jego przodkowie.</summary>
    Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetAncestorsAsync(
        IReadOnlyCollection<Guid> issueUuids,
        CancellationToken cancellationToken);

    /// <summary>Zgłoszenia osiągalne z każdego ze wskazanych po krawędziach
    /// <see cref="IssueLinkType.Blocks"/> — „co (pośrednio) blokuje to zgłoszenie".</summary>
    Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetBlockingReachableAsync(
        IReadOnlyCollection<Guid> issueUuids,
        CancellationToken cancellationToken);

    /// <summary>Zgłoszenia w poddrzewie wskazanych korzeni, w kolejności drzewa — tryb drzewa
    /// na liście. Zwraca pary (uuid, poziom zagnieżdżenia).</summary>
    Task<IReadOnlyList<(Guid Uuid, int Level, Guid RootUuid)>> GetSubtreeAsync(
        IReadOnlyCollection<Guid> rootUuids,
        CancellationToken cancellationToken);
}
