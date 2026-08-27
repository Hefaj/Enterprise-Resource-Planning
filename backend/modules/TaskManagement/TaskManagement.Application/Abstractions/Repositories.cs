using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="Issue"/> po stronie zapisu.</summary>
public interface IIssueRepository
{
    Task<Issue?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Issue issue);
}

/// <summary>Dostęp do agregatu <see cref="IssueAttachment"/> po stronie zapisu. Tylko dopisywanie
/// i odczyt po uuid — usunięcie idzie kaskadą po zgłoszeniu, nie osobną komendą na pliku
/// (patrz uzasadnienie przy <see cref="IssueAttachment"/>).</summary>
public interface IIssueAttachmentRepository
{
    Task<IssueAttachment?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(IssueAttachment attachment);
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

/// <summary>Zapis licznika numeracji projektu. Osobno od <see cref="IIssueKeyAllocator"/>,
/// bo to dwie różne operacje: tu chodzi o <b>założenie</b> licznika razem z projektem,
/// tam o atomowe pobranie kolejnego numeru.</summary>
public interface IProjectKeyCounterWriter
{
    void Add(ProjectKeyCounter counter);
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
