using System.Globalization;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Dodanie komentarza. <c>Uuid</c> to identyfikator <b>komentarza</b>, nie zgłoszenia — nadaje
/// go klient, bo tryb <c>Commands[]</c> wymaga identyfikatora w treści żądania.
///
/// <para><b>Tryb filtra nie ma tu sensu</b> i nikt go nie wywołuje: „skomentuj wszystkie
/// zgłoszenia pasujące do filtra” nie jest operacją, o którą ktokolwiek prosi. Endpoint stoi
/// na wspólnym szkielecie wsadowym, bo cała reszta zapisów w tym module tak wygląda i dzięki
/// temu komentarz dziedziczy idempotencję, sukces częściowy i ślad w historii zadań —
/// nie dlatego, że komentowanie masowe jest przewidziane.</para>
/// </summary>
public sealed class IssueAddCommentCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid zakładanego komentarza.</summary>
    public Guid Uuid { get; set; }

    public Guid IssueUuid { get; set; }

    /// <summary>Komentarz główny, na który to jest odpowiedź. <c>null</c> zakłada nowy wątek.</summary>
    public Guid? ParentUuid { get; set; }

    /// <summary>Treść w HTML z edytora; sanityzowana przed dotknięciem agregatu.</summary>
    public string Body { get; set; } = string.Empty;
}

public sealed class IssueAddCommentCommandHandler : CommandHandler<IssueAddCommentCommand, Guid>
{
    private readonly IIssueCommentRepository _comments;
    private readonly IIssueRepository _issues;
    private readonly IIssueActivityWriter _activity;
    private readonly IRichTextSanitizer _sanitizer;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueAddCommentCommandHandler(
        IIssueCommentRepository comments,
        IIssueRepository issues,
        IIssueActivityWriter activity,
        IRichTextSanitizer sanitizer,
        IIntegrationEventPublisher publisher,
        IExecutionContext executionContext,
        IClock clock)
    {
        _comments = comments;
        _issues = issues;
        _activity = activity;
        _sanitizer = sanitizer;
        _publisher = publisher;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueAddCommentCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        // Zgłoszenie musi istnieć zanim komentarz dostanie właściciela — inaczej klucz obcy
        // odbiłby się dopiero przy zapisie całego chunka, przewracając sąsiednie elementy.
        var issue = await _issues.FindAsync(command.IssueUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.IssueUuid);

        var author = IssueCreateCommandHandler.ActorUuid(_executionContext);
        var now = _clock.UtcNow;
        var body = _sanitizer.Sanitize(command.Body) ?? string.Empty;

        IssueComment comment;

        if (command.ParentUuid is { } parentUuid)
        {
            var parent = await _comments.FindAsync(parentUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(IssueComment), parentUuid);

            if (parent.IssueUuid != issue.Uuid)
            {
                throw new DomainException(
                    "taskmgmt.comment_parent_other_issue",
                    "Komentarz nadrzędny należy do innego zgłoszenia.");
            }

            comment = IssueComment.ReplyTo(command.Uuid, parent, body, author, now);
        }
        else
        {
            comment = IssueComment.Create(command.Uuid, issue.Uuid, body, author, now);
        }

        _comments.Add(comment);

        _activity.Add(IssueActivity.Record(
            issue.Uuid,
            IssueActivityKind.CommentAdded,
            fieldCode: null,
            oldValue: null,
            newValue: comment.Uuid.ToString(),
            author,
            _executionContext.CorrelationId,
            now));

        await NotifyAsync(issue, body, author, now, ct).ConfigureAwait(false);

        return comment.Uuid;
    }

    /// <summary>
    /// Prosi Notification o powiadomienie ludzi, których ten komentarz dotyczy.
    ///
    /// <para><b>Odbiorców ustala ten moduł</b>, nie Notification — tamten nie wie, czym jest
    /// zgłoszenie ani kto się nim zajmuje (<c>docs/backend/user-notifications.md</c>). Krąg jest
    /// wąski i zamknięty: zgłaszający, przypisany, obserwujący i wprost wzmiankowani. Autor
    /// wypada zawsze — nikt nie chce powiadomienia o własnej wypowiedzi.</para>
    ///
    /// <para>Zdarzenie idzie przez outbox, w tej samej transakcji co komentarz: albo obie rzeczy,
    /// albo żadna. Powiadomienie o komentarzu, którego zapis się nie powiódł, jest gorsze niż
    /// brak powiadomienia.</para>
    /// </summary>
    private async Task NotifyAsync(Issue issue, string body, Guid author, DateTimeOffset now, CancellationToken ct)
    {
        var recipients = new List<Guid> { issue.ReporterUuid };

        if (issue.AssigneeUuid is { } assignee)
        {
            recipients.Add(assignee);
        }

        recipients.AddRange(issue.Watchers);

        var mentioned = IssueMentions.Extract(body);
        recipients.AddRange(mentioned);

        recipients = [.. recipients.Where(uuid => uuid != Guid.Empty && uuid != author).Distinct()];

        if (recipients.Count == 0)
        {
            return;
        }

        // Wzmianka jest dla odbiorcy czymś innym niż „ktoś dopisał komentarz do zgłoszenia,
        // które obserwujesz" — stąd osobny rodzaj, po którym da się ustawić preferencje.
        var isMention = mentioned.Any(uuid => uuid != author);
        var kind = isMention ? "taskmgmt.issue.comment-mention" : "taskmgmt.issue.comment-added";

        await _publisher.PublishAsync(new UserNotificationRequested(
            recipients,
            ActorId: author,
            Kind: kind,
            SubjectSignature: AggregateSignatures.TaskManagementIssue,
            SubjectUuid: issue.Uuid,
            SubjectKey: issue.Key,
            TitleKey: $"shared.notifications.kinds.{kind}",
            Params: new Dictionary<string, string> { ["issueKey"] = issue.Key },
            // Grupowanie po wątku, nie po komentarzu: dziesięć wypowiedzi w jednym zgłoszeniu ma
            // być jedną pozycją w dzwonku, a nie dziesięcioma.
            GroupKey: $"taskmgmt.issue:{issue.Uuid}:comments",
            Link: $"/task-management/issue/{issue.Key}",
            Severity: NotificationSeverity.Info,
            CorrelationId: _executionContext.CorrelationId,
            OccurredAt: now), ct).ConfigureAwait(false);
    }
}

/// <summary>Zmiana treści własnego komentarza. Oryginał zostaje w agregacie
/// (<see cref="IssueComment.OriginalBody"/>) — patrz uzasadnienie przy tej klasie.</summary>
public sealed class IssueSetCommentBodyCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid komentarza.</summary>
    public Guid Uuid { get; set; }

    public string Body { get; set; } = string.Empty;
}

public sealed class IssueSetCommentBodyCommandHandler : CommandHandler<IssueSetCommentBodyCommand, Guid>
{
    private readonly IIssueCommentRepository _comments;
    private readonly IRichTextSanitizer _sanitizer;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueSetCommentBodyCommandHandler(
        IIssueCommentRepository comments,
        IRichTextSanitizer sanitizer,
        IExecutionContext executionContext,
        IClock clock)
    {
        _comments = comments;
        _sanitizer = sanitizer;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetCommentBodyCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var comment = await _comments.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueComment), command.Uuid);

        // Autorstwo sprawdza agregat, nie handler: to reguła domenowa, a nie kwestia tego,
        // którym endpointem przyszło żądanie.
        comment.SetBody(
            _sanitizer.Sanitize(command.Body) ?? string.Empty,
            IssueCreateCommandHandler.ActorUuid(_executionContext),
            _clock.UtcNow);

        // Edycja NIE dopisuje wpisu do historii zgłoszenia. Historia opisuje zmiany zgłoszenia,
        // a poprawiona literówka w komentarzu nią nie jest; ślad edycji niesie sam komentarz
        // (`edited_at` widoczne przy treści, oryginał w agregacie).
        return comment.Uuid;
    }
}

/// <summary>Usunięcie komentarza — miękkie, patrz <see cref="IssueComment.Remove"/>.</summary>
public sealed class IssueRemoveCommentCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid komentarza.</summary>
    public Guid Uuid { get; set; }
}

public sealed class IssueRemoveCommentCommandHandler : CommandHandler<IssueRemoveCommentCommand, Guid>
{
    private readonly IIssueCommentRepository _comments;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveCommentCommandHandler(
        IIssueCommentRepository comments,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _comments = comments;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveCommentCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var comment = await _comments.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueComment), command.Uuid);

        if (comment.IsRemoved)
        {
            return comment.Uuid;
        }

        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);
        var now = _clock.UtcNow;

        comment.Remove(now);

        _activity.Add(IssueActivity.Record(
            comment.IssueUuid,
            IssueActivityKind.CommentRemoved,
            fieldCode: null,
            oldValue: comment.Uuid.ToString(),
            newValue: null,
            actor,
            _executionContext.CorrelationId,
            now));

        return comment.Uuid;
    }
}

/// <summary>
/// Zamiana wartości pola na tekst do historii.
///
/// <para><b>Kultura niezmienna, świadomie.</b> Wpis historii jest zapisem technicznym czytanym
/// przez lata i przez różnych ludzi — data w formacie zależnym od ustawień serwera, który akurat
/// obsłużył żądanie, byłaby po roku nie do odczytania jednoznacznie. Formatowanie na język
/// użytkownika robi front, z surowej wartości.</para>
/// </summary>
internal static class IssueActivityValue
{
    public static string? From(DateTimeOffset? value)
        => value?.ToString("O", CultureInfo.InvariantCulture);

    public static string? From(Guid? value)
        => value is null || value == Guid.Empty ? null : value.Value.ToString();

    public static string? From(IssuePriority value)
        => value.ToString();
}
