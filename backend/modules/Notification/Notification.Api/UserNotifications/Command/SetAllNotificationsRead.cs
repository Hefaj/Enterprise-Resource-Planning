using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.UserNotifications;

namespace Notification.UserNotifications.Command;

/// <summary>„Oznacz wszystkie jako przeczytane" z popovera dzwonka.</summary>
public sealed class SetAllNotificationsReadEndpoint : EndpointWithoutRequest
{
    private readonly IUserNotificationCommands _commands;
    private readonly IExecutionContext _executionContext;

    public SetAllNotificationsReadEndpoint(IUserNotificationCommands commands, IExecutionContext executionContext)
    {
        _commands = commands;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("setAllNotificationsRead");
        Group<UserNotificationGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            await Send.NoContentAsync(ct);
            return;
        }

        await _commands.SetAllReadAsync(userId, ct);
        await Send.NoContentAsync(ct);
    }
}
