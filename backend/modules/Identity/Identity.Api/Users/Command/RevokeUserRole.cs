using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Command;

public sealed class RevokeUserRoleEndpoint : Endpoint<UserRevokeRoleCommand, Guid>
{
    private readonly ICommandHandler<UserRevokeRoleCommand, Guid> _handler;

    public RevokeUserRoleEndpoint(ICommandHandler<UserRevokeRoleCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("revoke-role");
        Group<UserGroup>();
    }

    public override async Task HandleAsync(UserRevokeRoleCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
