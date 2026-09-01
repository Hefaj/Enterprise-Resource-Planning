using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.UserNotifications;

namespace Notification.UserNotifications.Query;

/// <summary>Licznik nieprzeczytanych do odznaki dzwonka przy starcie aplikacji — reszta
/// przychodzi na bieżąco kanałem <c>notifications</c> (<c>ReceiveNotification</c>).</summary>
public sealed class GetUnreadCountEndpoint : EndpointWithoutRequest<GetUnreadCountResponse>
{
    private readonly IUserNotificationQueries _queries;
    private readonly IExecutionContext _executionContext;

    public GetUnreadCountEndpoint(IUserNotificationQueries queries, IExecutionContext executionContext)
    {
        _queries = queries;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("getUnreadCount");
        Group<UserNotificationGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            await Send.OkAsync(new GetUnreadCountResponse { Count = 0 }, ct);
            return;
        }

        var count = await _queries.GetUnreadCountAsync(userId, ct);
        await Send.OkAsync(new GetUnreadCountResponse { Count = count }, ct);
    }
}
