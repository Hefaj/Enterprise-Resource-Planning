using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Komentarz w widoku odczytu.
///
/// <para><c>Body</c> usuniętego komentarza jest puste, a nie „ukryte przez filtr po stronie
/// frontu” — treść nie wychodzi z serwera w ogóle. <see cref="OriginalBody"/> też nie: oryginał
/// jest zapisem na wypadek sporu, a nie drugą treścią do wyświetlenia obok bieżącej.</para>
/// </summary>
public sealed record IssueCommentDto(
    Guid Uuid,
    Guid IssueUuid,
    Guid? ParentUuid,
    string Body,
    Guid AuthorUuid,
    DateTimeOffset CreatedAt,
    DateTimeOffset? EditedAt,
    bool IsRemoved);

/// <summary>Wpis historii w widoku odczytu. Kod pola i rodzaj idą surowo — zdanie składa front
/// z kluczy tłumaczeń, bo historia nie ma języka po stronie serwera.</summary>
public sealed record IssueActivityDto(
    Guid Uuid,
    Guid IssueUuid,
    IssueActivityKind Kind,
    string? FieldCode,
    string? OldValue,
    string? NewValue,
    Guid ActorUuid,
    DateTimeOffset OccurredAt);

/// <summary>Żądanie listy komentarzy zgłoszenia.</summary>
public sealed class GetIssueCommentsRequest
{
    public Guid IssueUuid { get; set; }
}

/// <summary>Żądanie historii zgłoszenia.</summary>
public sealed class GetIssueActivityRequest
{
    public Guid IssueUuid { get; set; }
}

/// <summary>Odczyty komentarzy. Widoczność dziedziczy po zgłoszeniu — kto nie widzi zgłoszenia,
/// nie widzi jego dyskusji.</summary>
public interface IIssueCommentQueries
{
    /// <summary>Cały wątek zgłoszenia, najstarsze pierwsze. Odpowiedzi wracają w tej samej
    /// płaskiej liście z <c>ParentUuid</c> — poziom jest jeden, więc drzewo składa front
    /// jednym przebiegiem, bez rekurencji w SQL.</summary>
    Task<List<IssueCommentDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken);
}

/// <summary>Odczyty historii zgłoszenia.</summary>
public interface IIssueActivityQueries
{
    /// <summary>Historia zgłoszenia, <b>najnowsze pierwsze</b> — odwrotnie niż komentarze.
    /// Przy historii pytanie brzmi „co się ostatnio stało”, przy dyskusji — „jak to szło”.</summary>
    Task<List<IssueActivityDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken);
}
