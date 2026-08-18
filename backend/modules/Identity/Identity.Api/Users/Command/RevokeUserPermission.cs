using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Command;

public sealed class RevokeUserPermissionEndpoint : Endpoint<UserRevokePermissionCommand, Guid>
{
    private readonly ICommandHandler<UserRevokePermissionCommand, Guid> _handler;

    public RevokeUserPermissionEndpoint(ICommandHandler<UserRevokePermissionCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("revoke-permission");
        Group<UserGroup>();
    }

    public override async Task HandleAsync(UserRevokePermissionCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
