using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.UserNotifications;

namespace Notification.UserNotifications.Query;

/// <summary>Pobiera wskazane wpisy wyłącznie z własnej skrzynki zalogowanego użytkownika.</summary>
public sealed class GetUserNotificationEndpoint : Endpoint<GetUserNotificationRequest, List<UserNotificationDto>>
{
    private readonly IUserNotificationQueries _queries;
    private readonly IExecutionContext _executionContext;

    public GetUserNotificationEndpoint(IUserNotificationQueries queries, IExecutionContext executionContext)
    {
        _queries = queries;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("getUserNotification");
        Group<UserNotificationGroup>();
    }

    public override async Task HandleAsync(GetUserNotificationRequest req, CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            await Send.OkAsync([], ct);
            return;
        }

        await Send.OkAsync(await _queries.GetAsync(req.Uuids, userId, ct), ct);
    }
}
