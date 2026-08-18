using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Command;

public sealed class RemoveRolePermissionEndpoint : Endpoint<RoleRemovePermissionCommand, Guid>
{
    private readonly ICommandHandler<RoleRemovePermissionCommand, Guid> _handler;

    public RemoveRolePermissionEndpoint(ICommandHandler<RoleRemovePermissionCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("remove-permission");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(RoleRemovePermissionCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
