using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Command;

/// <summary>Dołącza rolę składową do kontenera — walidacja cyklu dzieje się w handlerze
/// (<see cref="RoleAddMemberCommandHandler"/>), nie tutaj.</summary>
public sealed class AddRoleMemberEndpoint : Endpoint<RoleAddMemberCommand, Guid>
{
    private readonly ICommandHandler<RoleAddMemberCommand, Guid> _handler;

    public AddRoleMemberEndpoint(ICommandHandler<RoleAddMemberCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("add-member");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(RoleAddMemberCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
