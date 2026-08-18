using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Command;

public sealed class AddRolePermissionEndpoint : Endpoint<RoleAddPermissionCommand, Guid>
{
    private readonly ICommandHandler<RoleAddPermissionCommand, Guid> _handler;

    public AddRolePermissionEndpoint(ICommandHandler<RoleAddPermissionCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("add-permission");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(RoleAddPermissionCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
