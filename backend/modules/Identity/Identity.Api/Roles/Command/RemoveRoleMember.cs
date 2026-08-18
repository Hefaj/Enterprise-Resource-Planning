using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Command;

public sealed class RemoveRoleMemberEndpoint : Endpoint<RoleRemoveMemberCommand, Guid>
{
    private readonly ICommandHandler<RoleRemoveMemberCommand, Guid> _handler;

    public RemoveRoleMemberEndpoint(ICommandHandler<RoleRemoveMemberCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("remove-member");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(RoleRemoveMemberCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
