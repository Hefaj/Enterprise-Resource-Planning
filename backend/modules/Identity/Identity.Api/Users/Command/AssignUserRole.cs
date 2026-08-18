using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Command;

public sealed class AssignUserRoleEndpoint : Endpoint<UserAssignRoleCommand, Guid>
{
    private readonly ICommandHandler<UserAssignRoleCommand, Guid> _handler;

    public AssignUserRoleEndpoint(ICommandHandler<UserAssignRoleCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("assign-role");
        Group<UserGroup>();
    }

    public override async Task HandleAsync(UserAssignRoleCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
