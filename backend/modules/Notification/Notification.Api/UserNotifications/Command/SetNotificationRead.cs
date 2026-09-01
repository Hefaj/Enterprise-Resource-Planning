using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.UserNotifications;

namespace Notification.UserNotifications.Command;

/// <summary>Oznacza jeden wpis feedu jako przeczytany — poza pipeline'em komend, patrz
/// <see cref="IUserNotificationCommands"/>.</summary>
public sealed class SetNotificationReadEndpoint : Endpoint<SetNotificationReadRequest>
{
    private readonly IUserNotificationCommands _commands;
    private readonly IExecutionContext _executionContext;

    public SetNotificationReadEndpoint(IUserNotificationCommands commands, IExecutionContext executionContext)
    {
        _commands = commands;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("setNotificationRead");
        Group<UserNotificationGroup>();
    }

    public override async Task HandleAsync(SetNotificationReadRequest req, CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            await Send.NoContentAsync(ct);
            return;
        }

        await _commands.SetReadAsync(req.Uuid, userId, ct);
        await Send.NoContentAsync(ct);
    }
}
