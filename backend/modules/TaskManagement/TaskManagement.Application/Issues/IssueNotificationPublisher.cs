using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Buduje i publikuje <c>UserNotificationRequested</c> dla zdarzeń zgłoszenia (NTF-002) —
/// jedno miejsce, żeby konwencja <c>Link</c>/<c>TitleKey</c>/<c>GroupKey</c> nie rozjechała się
/// między siedmioma miejscami wywołania (<c>docs/backend/user-notifications.md</c>,
/// <c>docs/backend/task-management-requirements.md</c> REQ-005).
///
/// <para><b>Odbiorcy zawsze z pominięciem sprawcy</b> — Notification i tak wyklucza <c>ActorId</c>
/// z fan-outu, ale odfiltrowanie tutaj oszczędza puste zdarzenia, gdy sprawca był jedynym
/// obserwującym.</para>
/// </summary>
public sealed class IssueNotificationPublisher
{
    private readonly IIntegrationEventPublisher _publisher;

    public IssueNotificationPublisher(IIntegrationEventPublisher publisher)
    {
        _publisher = publisher;
    }

    /// <summary>Nowy przypisany dostaje powiadomienie — nie dostaje go sam siebie przypisujący.</summary>
    public Task PublishAssignedAsync(
        Issue issue, Guid? actorUuid, DateTimeOffset now, Guid correlationId, CancellationToken ct)
    {
        if (issue.AssigneeUuid is not { } assignee || assignee == actorUuid)
        {
            return Task.CompletedTask;
        }

        return PublishAsync(
            [assignee.ToString()], actorUuid, "taskmgmt.issue.assigned", issue, groupKey: null,
            now, correlationId, ct);
    }

    /// <summary>Wzmiankowany w treści komentarza/opisu — jeden odbiorca na wywołanie, wołane raz
    /// na wzmiankę.</summary>
    public Task PublishMentionedAsync(
        Issue issue, Guid mentionedUuid, Guid? actorUuid, DateTimeOffset now, Guid correlationId, CancellationToken ct)
        => PublishAsync(
            [mentionedUuid.ToString()], actorUuid, "taskmgmt.issue.mentioned", issue, groupKey: null,
            now, correlationId, ct);

    /// <summary>Nowy komentarz — do obserwujących. Grupowane po zgłoszeniu: kilka komentarzy pod
    /// rząd zanim ktoś zdąży przeczytać poprzedni ma dać jeden wpis z licznikiem, nie zalew wpisów.
    ///
    /// <para><paramref name="excludeRecipients"/> pomija wzmiankowanych w TYM komentarzu — dostali
    /// już bardziej precyzyjne <c>taskmgmt.issue.mentioned</c>, więc drugie, ogólne powiadomienie
    /// o tym samym fakcie byłoby szumem, nie informacją.</para></summary>
    public Task PublishCommentedAsync(
        Issue issue,
        Guid? actorUuid,
        DateTimeOffset now,
        Guid correlationId,
        CancellationToken ct,
        IReadOnlyCollection<Guid>? excludeRecipients = null)
        => PublishToWatchersAsync(
            issue, actorUuid, "taskmgmt.issue.commented",
            groupKey: $"taskmgmt.issue:{issue.Uuid}:commented", now, correlationId, ct,
            excludeRecipients: excludeRecipients);

    /// <summary>Zmiana stanu — do obserwujących, bez grupowania: każde przejście jest osobnym
    /// faktem wartym osobnego wpisu.</summary>
    public Task PublishStateChangedAsync(
        Issue issue, Guid? actorUuid, DateTimeOffset now, Guid correlationId, CancellationToken ct)
        => PublishToWatchersAsync(issue, actorUuid, "taskmgmt.issue.state_changed", groupKey: null, now, correlationId, ct);

    /// <summary>Zbliżający się/miniony termin (REQ-005) — do obserwujących i przypisanego, bez
    /// sprawcy (skan terminów nie ma sprawcy). Grupowane po zgłoszeniu, żeby powtórne
    /// przypomnienie tego samego terminu inkrementowało istniejący wpis zamiast zakładać kolejny.</summary>
    public Task PublishDueAsync(Issue issue, bool overdue, DateTimeOffset now, Guid correlationId, CancellationToken ct)
        => PublishToWatchersAsync(
            issue, actorUuid: null, overdue ? "taskmgmt.issue.overdue" : "taskmgmt.issue.due_soon",
            groupKey: $"taskmgmt.issue:{issue.Uuid}:due", now, correlationId, ct,
            severity: overdue ? NotificationSeverity.Warning : NotificationSeverity.Info,
            includeAssignee: true);

    /// <summary>Akcja „wyślij powiadomienie" reguły automatyzacji (AUT-001 `then`) — do
    /// obserwujących, bez sprawcy (reguła nie ma sprawcy-człowieka). Osobny rodzaj zdarzenia od
    /// <c>taskmgmt.issue.state_changed</c> itp., żeby odbiorca widział, że to reguła, nie
    /// organiczna zmiana.</summary>
    public Task PublishAutomationAsync(
        Issue issue, string ruleName, DateTimeOffset now, Guid correlationId, CancellationToken ct)
        => PublishToWatchersAsync(
            issue, actorUuid: null, "taskmgmt.issue.automation_triggered",
            groupKey: null, now, correlationId, ct, includeAssignee: true,
            extraParams: new Dictionary<string, string> { ["ruleName"] = ruleName });

    /// <summary>Wszystkie realizacje zlecenia zamknięte (REQ-003) — do obserwujących zlecenia.
    /// Bez sprawcy: to fakt wyliczony automatycznie, nie akcja jednej osoby.</summary>
    public Task PublishRequestDeliveredAsync(Issue request, DateTimeOffset now, Guid correlationId, CancellationToken ct)
        => PublishToWatchersAsync(request, actorUuid: null, "taskmgmt.request.delivered", groupKey: null, now, correlationId, ct);

    private Task PublishToWatchersAsync(
        Issue issue,
        Guid? actorUuid,
        string kind,
        string? groupKey,
        DateTimeOffset now,
        Guid correlationId,
        CancellationToken ct,
        NotificationSeverity severity = NotificationSeverity.Info,
        bool includeAssignee = false,
        IReadOnlyCollection<Guid>? excludeRecipients = null,
        IReadOnlyDictionary<string, string>? extraParams = null)
    {
        var recipients = issue.Watchers
            .Where(w => w.OptedOutAt is null)
            .Select(w => w.UserUuid)
            .ToHashSet();

        if (includeAssignee && issue.AssigneeUuid is { } assignee)
        {
            recipients.Add(assignee);
        }

        if (actorUuid is { } actor)
        {
            recipients.Remove(actor);
        }

        if (excludeRecipients is not null)
        {
            recipients.ExceptWith(excludeRecipients);
        }

        if (recipients.Count == 0)
        {
            return Task.CompletedTask;
        }

        return PublishAsync(
            recipients.Select(r => r.ToString()).ToList(), actorUuid, kind, issue, groupKey, now, correlationId, ct,
            severity, extraParams);
    }

    private Task PublishAsync(
        IReadOnlyList<string> recipients,
        Guid? actorUuid,
        string kind,
        Issue issue,
        string? groupKey,
        DateTimeOffset now,
        Guid correlationId,
        CancellationToken ct,
        NotificationSeverity severity = NotificationSeverity.Info,
        IReadOnlyDictionary<string, string>? extraParams = null)
    {
        // Klucz tytułu wg konwencji `shared.notifications.kinds.*` (docs/backend/
        // user-notifications.md §3) — jedna przestrzeń nazw tłumaczeń dla wszystkich modułów,
        // bo Notification (i inne moduły) nie ładują scope'u `taskmgmt`.
        var titleKey = "shared.notifications.kinds." + kind.Replace('.', '_');

        var parameters = new Dictionary<string, string> { ["issueKey"] = issue.Key, ["issueTitle"] = issue.Title };

        if (extraParams is not null)
        {
            foreach (var (key, value) in extraParams)
            {
                parameters[key] = value;
            }
        }

        var integrationEvent = new UserNotificationRequested(
            recipients,
            actorUuid is { } actor && actor != Guid.Empty ? actor.ToString() : null,
            kind,
            AggregateSignatures.TaskManagementIssue,
            issue.Uuid,
            issue.Key,
            titleKey,
            parameters,
            groupKey,
            $"/task-management/issue/{issue.Key}",
            severity,
            correlationId,
            now);

        return _publisher.PublishAsync(integrationEvent, ct);
    }
}
