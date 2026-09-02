using TaskManagement.Application.Issues;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Resolutions;
using TaskManagement.Domain.Sprints;
using TaskManagement.Domain.Tags;
using TaskManagement.Domain.Workflow;
using TaskManagement.Domain.WorkTypes;

namespace TaskManagement.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="Issue"/> po stronie zapisu.</summary>
public interface IIssueRepository
{
    Task<Issue?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>Całe poddrzewo potomków (rekurencyjnie, nie tylko dzieci bezpośrednie) —
    /// przenoszenie zgłoszenia do innego projektu przenosi je razem z nim (ISS-010 AC3).
    ///
    /// <para>Hierarchia dopuszcza dowolną głębokość między Epikiem a Podzadaniem (zabronione
    /// są tylko skrajne role: Epik jako dziecko, Podzadanie jako rodzic), więc odczyt idzie
    /// falami — kolejne zapytanie po dzieci bieżącej fali, aż fala będzie pusta — zamiast
    /// zakładać z góry maksymalną głębokość.</para></summary>
    Task<IReadOnlyList<Issue>> FindDescendantsAsync(Guid rootUuid, CancellationToken cancellationToken);

    void Add(Issue issue);
}

/// <summary>Dostęp do agregatu <see cref="IssueAttachment"/> po stronie zapisu. Tylko dopisywanie
/// i odczyt po uuid — usunięcie idzie kaskadą po zgłoszeniu, nie osobną komendą na pliku
/// (patrz uzasadnienie przy <see cref="IssueAttachment"/>).</summary>
public interface IIssueAttachmentRepository
{
    Task<IssueAttachment?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(IssueAttachment attachment);

    void Remove(IssueAttachment attachment);
}

/// <summary>Dostęp do komentarzy zgłoszenia po stronie zapisu. Odpowiedź potrzebuje rodzica
/// jako obiektu, bo regułę „wątki są jednopoziomowe” egzekwuje agregat
/// (<see cref="IssueComment.ReplyTo"/>), a nie handler.</summary>
public interface IIssueCommentRepository
{
    Task<IssueComment?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(IssueComment comment);
}

/// <summary>
/// Dopisywanie wpisów historii zgłoszenia.
///
/// <para>Świadomie <b>nie</b> repozytorium: historia jest tylko do dopisywania, więc interfejs
/// z <c>FindAsync</c> i <c>Remove</c> kłamałby o tym, co z nią wolno zrobić. Odczyt idzie
/// projekcją przez <see cref="IIssueActivityQueries"/>, jak każdy inny odczyt w tym module.</para>
///
/// <para>Wpis powstaje w tej samej jednostce pracy, co zmiana, którą opisuje — nie ma ścieżki,
/// w której zmiana się zapisze, a historia nie (<c>docs/backend/task-management.md</c> §11).</para>
/// </summary>
public interface IIssueActivityWriter
{
    void Add(IssueActivity activity);
}

/// <summary>Dostęp do krawędzi grafu powiązań po stronie zapisu. <c>Remove</c> jest tu
/// pełnoprawną operacją — w odróżnieniu od komentarza krawędź usuwa się twardo, bo nie ma
/// czego zachowywać: „było powiązanie, już go nie ma" niesie całą treść tej zmiany, a ślad
/// zostaje w historii zgłoszenia.</summary>
public interface IIssueLinkRepository
{
    Task<IssueLink?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(IssueLink link);

    void Remove(IssueLink link);
}

/// <summary>Dostęp do agregatu <see cref="Board"/> po stronie zapisu — ładuje tablicę razem
/// z kolumnami, bo układ kolumn zmienia się metodą agregatu.</summary>
public interface IBoardRepository
{
    Task<Board?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Board board);
}

/// <summary>
/// Dostęp do kart tablicy po stronie zapisu.
///
/// <para>Interfejs jest niesymetryczny wobec pozostałych repozytoriów i to jest celowe: karty
/// przestawia się <b>zawsze w kontekście całej tablicy</b>, bo rank wylicza się z sąsiadów.
/// Metoda „znajdź jedną kartę” zachęcałaby do policzenia ranku bez wiedzy o sąsiadach, czyli
/// do jedynego błędu, przed którym cały ten schemat ma chronić
/// (<c>docs/backend/task-management.md</c> §7.2).</para>
/// </summary>
public interface IBoardCardRepository
{
    /// <summary>
    /// Karty tablicy — śledzone, w kolejności <c>(rank, uuid)</c>, z <b>uzupełnieniem
    /// brakujących</b>.
    ///
    /// <para>Zgłoszenie, którego nikt jeszcze nie przestawiał, nie ma wiersza w
    /// <c>board_card</c>. Pierwsze przeciągnięcie na tablicy zakłada wiersze wszystkim jej
    /// zgłoszeniom naraz, w kolejności, w jakiej użytkownik je właśnie widział — inaczej
    /// sąsiedzi upuszczonej karty bywają bez ranku i nie ma między czym szukać środka.
    /// Kolejne przeciągnięcia to już jeden <c>UPDATE</c> jednego wiersza.</para>
    /// </summary>
    Task<IReadOnlyList<BoardCard>> MaterializeBoardAsync(
        Guid boardUuid,
        DateTimeOffset now,
        CancellationToken cancellationToken);

    /// <summary>
    /// Karty niedokończonych zgłoszeń (stan poza kategorią <c>Done</c>) w danym sprincie,
    /// śledzone.
    ///
    /// <para>Wywoływane wyłącznie z zamknięcia sprintu (SPR-003 AC1) — użytkownik decyduje
    /// jawnie, dokąd trafiają: do backlogu (<c>SetSprint(null, …)</c>) albo do wskazanego
    /// następnego sprintu. Ciche przeniesienie nie istnieje, bo nikt wtedy nie ufałby
    /// raportowi z zamkniętej iteracji.</para>
    /// </summary>
    Task<IReadOnlyList<BoardCard>> FindUnfinishedInSprintAsync(Guid sprintUuid, CancellationToken cancellationToken);
}

/// <summary>Dostęp do agregatu <see cref="Sprint"/> po stronie zapisu.</summary>
public interface ISprintRepository
{
    Task<Sprint?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Sprint sprint);
}

/// <summary>Dostęp do agregatu <see cref="Tag"/> po stronie zapisu (TAG-001).</summary>
public interface ITagRepository
{
    Task<Tag?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Tag tag);
}

/// <summary>Dostęp do agregatu <see cref="Resolution"/> po stronie zapisu (ISS-007).</summary>
public interface IResolutionRepository
{
    Task<Resolution?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Resolution resolution);
}

/// <summary>Dostęp do agregatu <see cref="IssueWorkLog"/> po stronie zapisu (TIME-001).
/// Osobno od <see cref="IIssueRepository"/>, wzorem <see cref="IIssueCommentRepository"/> —
/// patrz uzasadnienie przy <see cref="IssueWorkLog"/>.</summary>
public interface IIssueWorkLogRepository
{
    Task<IssueWorkLog?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(IssueWorkLog workLog);

    void Remove(IssueWorkLog workLog);
}

/// <summary>Dostęp do agregatu <see cref="WorkType"/> po stronie zapisu (TIME-001 AC2).</summary>
public interface IWorkTypeRepository
{
    Task<WorkType?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(WorkType workType);
}

/// <summary>Dostęp do agregatu <see cref="Project"/> po stronie zapisu — ładuje projekt
/// razem z członkami, bo rola w projekcie zmienia się metodą agregatu.</summary>
public interface IProjectRepository
{
    Task<Project?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Project project);
}

/// <summary>Dostęp do agregatu <see cref="WorkflowScheme"/> — po stronie zapisu wyłącznie
/// do odczytu przez komendy zgłoszenia (schemat jest daną konfiguracyjną, nie zmienia się
/// przy zmianie stanu zgłoszenia).</summary>
public interface IWorkflowSchemeRepository
{
    Task<WorkflowScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>Schemat wskazany przez projekt — jedno zapytanie zamiast dwóch po stronie
    /// każdego handlera komendy zgłoszenia.</summary>
    Task<WorkflowScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken);

    void Add(WorkflowScheme scheme);
}

/// <summary>Dostęp do agregatu <see cref="IssueTypeScheme"/> — wzorzec identyczny jak
/// <see cref="IWorkflowSchemeRepository"/>: po stronie zapisu głównie do odczytu przez komendy
/// zgłoszenia i projektu, schemat jest daną konfiguracyjną (TYP-001).</summary>
public interface IIssueTypeSchemeRepository
{
    Task<IssueTypeScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>Schemat wskazany przez projekt — jedno zapytanie zamiast dwóch po stronie
    /// każdego handlera komendy zgłoszenia.</summary>
    Task<IssueTypeScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken);

    void Add(IssueTypeScheme scheme);
}

/// <summary>
/// Pytanie „ile zgłoszeń używa tego typu" — sonda poza granicą agregatu, analogicznie do
/// <see cref="IFieldUsageProbe"/>. Egzekwuje TYP-004: usunięcie typu w użyciu jest odrzucane,
/// a komunikat niesie liczbę zgłoszeń, nie ogólny błąd.
/// </summary>
public interface IIssueTypeUsageProbe
{
    Task<int> CountByTypeAsync(Guid typeUuid, CancellationToken cancellationToken);
}

/// <summary>Dostęp do agregatu <see cref="FieldScheme"/> po stronie zapisu — ładuje schemat
/// razem z definicjami pól, bo to jeden agregat i reguły slotów obowiązują w jego całości.</summary>
public interface IFieldSchemeRepository
{
    Task<FieldScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>Schemat pól wskazany przez projekt albo <c>null</c>, gdy projekt nie ma pól
    /// własnych — to stan normalny, nie brak konfiguracji.</summary>
    Task<FieldScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken);

    void Add(FieldScheme scheme);
}

/// <summary>
/// Pytanie „czy którekolwiek zgłoszenie ma wartość w tym polu".
///
/// <para>Świadomie <b>nie</b> repozytorium: to jedno zapytanie zbiorcze przez granicę agregatu,
/// a nie dostęp do zgłoszeń po stronie zapisu. Reguła, której broni („mapowanie pole↔slot jest
/// niezmienne po pierwszym użyciu"), mieszka poza <see cref="FieldScheme"/>, bo dane, o które
/// pyta, leżą na zgłoszeniach — a agregat nie widzi poza swoją granicę
/// (<c>docs/backend/task-management.md</c> §6).</para>
/// </summary>
public interface IFieldUsageProbe
{
    Task<bool> IsUsedAsync(Guid fieldSchemeUuid, string fieldCode, CancellationToken cancellationToken);
}

/// <summary>Zapis licznika numeracji projektu. Osobno od <see cref="IIssueKeyAllocator"/>,
/// bo to dwie różne operacje: tu chodzi o <b>założenie</b> licznika razem z projektem,
/// tam o atomowe pobranie kolejnego numeru.</summary>
public interface IProjectKeyCounterWriter
{
    void Add(ProjectKeyCounter counter);

    /// <summary>Podmienia prefiks licznika po zmianie kodu projektu (PRJ-003) — istniejące
    /// zgłoszenia zachowują stare klucze, nowe dostają nowy prefiks. Osobna metoda, nie
    /// wczytanie agregatu przez EF, z tego samego powodu co <see cref="IIssueKeyAllocator"/>:
    /// licznik nie jest agregatem śledzonym przez change tracker.</summary>
    Task SetPrefixAsync(Guid projectUuid, string prefix, CancellationToken cancellationToken);
}

/// <summary>
/// Nadanie kolejnego klucza czytelnego (<c>DEV-123</c>) w obrębie projektu.
///
/// <para>Abstrakcja istnieje, bo implementacja jest <b>zapytaniem SQL</b>
/// (<c>UPDATE … RETURNING</c>), a nie operacją na agregacie — a warstwa aplikacji nie zna
/// SQL-a. Wywołanie musi trafić w tę samą transakcję, co zapis zgłoszenia
/// (<c>docs/backend/task-management.md</c> §4).</para>
/// </summary>
public interface IIssueKeyAllocator
{
    /// <summary>Rezerwuje jeden numer i zwraca gotowy klucz.</summary>
    Task<string> AllocateAsync(Guid projectUuid, CancellationToken cancellationToken);

    /// <summary>Rezerwuje <paramref name="count"/> kolejnych numerów jednym przeskokiem licznika
    /// i zwraca gotowe klucze — jeden chunk operacji masowej to jeden <c>UPDATE</c>, nie N.</summary>
    Task<IReadOnlyList<string>> AllocateRangeAsync(Guid projectUuid, int count, CancellationToken cancellationToken);
}
