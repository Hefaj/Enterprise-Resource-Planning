using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Komentarz pod zgłoszeniem.
///
/// <para><b>Wątkowanie jest jednopoziomowe</b> (<c>docs/modules/task-management/domain.md</c> §11):
/// odpowiedź wskazuje komentarz główny i nic głębiej. Drzewo bez ograniczenia głębokości
/// wymaga w UI wcięć, zwijania i decyzji „co pokazać przy dwudziestym poziomie”, a dyskusja
/// przy zgłoszeniu i tak toczy się w jednym wątku — to nie jest forum.</para>
///
/// <para><b>Edycja zachowuje pierwotną treść.</b> Przy sporze „ale on to napisał” liczy się
/// oryginał, a nie ostatnia wersja — dlatego <see cref="OriginalBody"/> zapisuje się przy
/// PIERWSZEJ edycji i już nigdy nie zmienia. Trzymanie pełnej historii wersji byłoby drugą
/// tabelą audytową obok <c>issue_activity</c>, a odpowiada na to samo pytanie.</para>
///
/// <para><b>Usunięcie jest miękkie.</b> Komentarz z odpowiedziami skasowany twardo zabrałby
/// im kotwicę albo (przy <c>Restrict</c>) w ogóle by nie przeszedł. Wiersz zostaje, treść
/// znika — wątek nadal się czyta.</para>
/// </summary>
public sealed class IssueComment : AggregateRoot
{
    /// <summary>Górna granica treści. Komentarz dłuższy niż to jest opisem zgłoszenia albo
    /// dokumentem — jednym i drugim system już się zajmuje w innym miejscu.</summary>
    public const int MaxBodyLength = 20_000;

    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueComment()
    {
    }

    private IssueComment(
        Guid uuid,
        Guid issueUuid,
        Guid? parentUuid,
        string body,
        Guid authorUuid,
        DateTimeOffset createdAt) : base(uuid)
    {
        IssueUuid = issueUuid;
        ParentUuid = parentUuid;
        Body = body;
        AuthorUuid = authorUuid;
        CreatedAt = createdAt;
    }

    public Guid IssueUuid { get; private set; }

    /// <summary>Komentarz główny, na który to jest odpowiedź. <c>null</c> dla komentarza
    /// głównego — i tylko takie mogą być rodzicem (patrz <see cref="ReplyTo"/>).</summary>
    public Guid? ParentUuid { get; private set; }

    /// <summary>Treść w HTML z edytora; czyści ją sanitizer w warstwie aplikacji, zanim tu
    /// trafi — dokładnie jak opis zgłoszenia.</summary>
    public string Body { get; private set; } = string.Empty;

    /// <summary>Treść sprzed pierwszej edycji. <c>null</c>, dopóki nikt nie edytował.</summary>
    public string? OriginalBody { get; private set; }

    public Guid AuthorUuid { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? EditedAt { get; private set; }

    public DateTimeOffset? RemovedAt { get; private set; }

    public bool IsRemoved => RemovedAt is not null;

    /// <summary>Komentarz główny w wątku zgłoszenia.</summary>
    public static IssueComment Create(
        Guid uuid,
        Guid issueUuid,
        string body,
        Guid authorUuid,
        DateTimeOffset createdAt)
        => new(uuid, RequireIssue(issueUuid), null, ValidateBody(body), authorUuid, createdAt);

    /// <summary>
    /// Odpowiedź na komentarz główny. Rodzic wchodzi obiektem, a nie identyfikatorem, bo
    /// jedyna reguła, jaka tu obowiązuje — „rodzic sam nie jest odpowiedzią” — wymaga
    /// przeczytania jego stanu. Sprawdzenie po samym uuid dałoby regułę, którą wywołujący
    /// może pominąć.
    /// </summary>
    public static IssueComment ReplyTo(
        Guid uuid,
        IssueComment parent,
        string body,
        Guid authorUuid,
        DateTimeOffset createdAt)
    {
        ArgumentNullException.ThrowIfNull(parent);

        if (parent.ParentUuid is not null)
        {
            throw new DomainException(
                "taskmgmt.comment_thread_too_deep",
                "Odpowiadać można wyłącznie na komentarz główny — wątki są jednopoziomowe.");
        }

        if (parent.IsRemoved)
        {
            throw new DomainException(
                "taskmgmt.comment_removed",
                "Nie można odpowiedzieć na usunięty komentarz.");
        }

        return new IssueComment(uuid, parent.IssueUuid, parent.Uuid, ValidateBody(body), authorUuid, createdAt);
    }

    /// <summary>
    /// Zmienia treść. <paramref name="editorUuid"/> musi być autorem — cudzy komentarz da się
    /// usunąć (moderacja), ale nie przepisać: podmieniona treść pod cudzym nazwiskiem jest
    /// gorsza niż brak komentarza.
    /// </summary>
    public void SetBody(string body, Guid editorUuid, DateTimeOffset now)
    {
        if (IsRemoved)
        {
            throw new DomainException("taskmgmt.comment_removed", "Usunięty komentarz nie podlega edycji.");
        }

        if (editorUuid != AuthorUuid)
        {
            throw new DomainException(
                "taskmgmt.comment_not_author",
                "Edytować komentarz może wyłącznie jego autor.");
        }

        var next = ValidateBody(body);

        if (next == Body)
        {
            return;
        }

        // Pierwsza edycja utrwala oryginał; kolejne już go nie ruszają.
        OriginalBody ??= Body;
        Body = next;
        EditedAt = now;
    }

    /// <summary>Miękkie usunięcie. Treść znika, wiersz zostaje — odpowiedzi mają się do czego
    /// przypiąć, a historia nie dostaje dziury.</summary>
    public void Remove(DateTimeOffset now)
    {
        if (IsRemoved)
        {
            return;
        }

        OriginalBody ??= Body;
        Body = string.Empty;
        RemovedAt = now;
    }

    private static Guid RequireIssue(Guid issueUuid)
        => issueUuid == Guid.Empty
            ? throw new DomainException("taskmgmt.comment_issue_empty", "Komentarz musi należeć do zgłoszenia.")
            : issueUuid;

    private static string ValidateBody(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new DomainException("taskmgmt.comment_body_empty", "Treść komentarza nie może być pusta.");
        }

        var trimmed = body.Trim();

        if (trimmed.Length > MaxBodyLength)
        {
            throw new DomainException(
                "taskmgmt.comment_body_too_long",
                $"Treść komentarza może mieć najwyżej {MaxBodyLength} znaków.");
        }

        return trimmed;
    }
}
