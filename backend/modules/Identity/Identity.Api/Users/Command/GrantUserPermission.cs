using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;
using Identity.Application.Users;

namespace Identity.Users.Command;

public sealed class GrantUserPermissionEndpoint : Endpoint<UserGrantPermissionCommand, Guid>
{
    private readonly ICommandHandler<UserGrantPermissionCommand, Guid> _handler;

    public GrantUserPermissionEndpoint(ICommandHandler<UserGrantPermissionCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("grant-permission");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
    }

    public override async Task HandleAsync(UserGrantPermissionCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
