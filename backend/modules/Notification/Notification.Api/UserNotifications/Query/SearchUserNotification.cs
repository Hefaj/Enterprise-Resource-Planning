using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.UserNotifications;

namespace Notification.UserNotifications.Query;

/// <summary>Stronicowany feed powiadomień bieżącego użytkownika.</summary>
public sealed class SearchUserNotificationEndpoint : Endpoint<SearchUserNotificationRequest, SearchResponse>
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
            await Send.OkAsync(new SearchResponse { Uuids = [], TotalCount = 0 }, ct);
            return;
        }

        await Send.OkAsync(await _queries.SearchAsync(req, userId, ct), ct);
    }
}
