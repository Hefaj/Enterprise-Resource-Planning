using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.UserNotifications;

namespace Notification.UserNotifications.Query;

/// <summary>Feed powiadomień własnego użytkownika. Celowo bez <c>Permissions(...)</c> i zawężone
/// do <c>IExecutionContext.UserId</c> — jak <c>SearchJobEndpoint</c> (patrz uzasadnienie tam).</summary>
public sealed class SearchUserNotificationEndpoint : Endpoint<SearchUserNotificationRequest, SearchUserNotificationResponse>
{
    private readonly IUserNotificationQueries _queries;
    private readonly IExecutionContext _executionContext;

    public SearchUserNotificationEndpoint(IUserNotificationQueries queries, IExecutionContext executionContext)
    {
        _queries = queries;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("searchUserNotification");
        Group<UserNotificationGroup>();
    }

    public override async Task HandleAsync(SearchUserNotificationRequest req, CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            await Send.OkAsync(new SearchUserNotificationResponse(), ct);
            return;
        }

        var response = await _queries.SearchAsync(req, userId, ct);
        await Send.OkAsync(response, ct);
    }
}
