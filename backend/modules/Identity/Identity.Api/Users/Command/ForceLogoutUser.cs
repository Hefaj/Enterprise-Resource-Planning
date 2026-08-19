using FastEndpoints;
using Identity.Application.Users;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Users.Command;

/// <summary>Wymuszone wylogowanie — unieważnia sesje w Keycloaku i cache uprawnień (patrz
/// <c>UserForceLogoutCommandHandler</c>). Uuid w ścieżce, nie w body — akcja adresuje jeden
/// konkretny zasób, spójnie z konwencją REST reszty grupy <c>user</c>.</summary>
public sealed class ForceLogoutUserRequest
{
    public Guid Uuid { get; set; }
}

public sealed class ForceLogoutUserEndpoint : Endpoint<ForceLogoutUserRequest, Guid>
{
    private readonly ICommandHandler<UserForceLogoutCommand, Guid> _handler;

    public ForceLogoutUserEndpoint(ICommandHandler<UserForceLogoutCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("{Uuid}/force-logout");
        Group<UserGroup>();
        Permissions(P.Identity.UserManage);
    }

    public override async Task HandleAsync(ForceLogoutUserRequest req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(new UserForceLogoutCommand { UserUuid = req.Uuid }, ct);
        await Send.OkAsync(uuid, ct);
    }
}
