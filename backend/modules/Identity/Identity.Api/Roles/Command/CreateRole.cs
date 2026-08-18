using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Command;

/// <summary>Zakłada nową rolę. Inaczej niż operacje masowe w Catalog/Sales, komendy Identity
/// nie idą przez <c>BatchEndpointBase</c> — endpoint tylko rozwiązuje handler z DI i woła go
/// wprost (patrz uzasadnienie w <c>Identity.Application.Roles.RoleCommands</c>).</summary>
public sealed class CreateRoleEndpoint : Endpoint<RoleCreateCommand, Guid>
{
    private readonly ICommandHandler<RoleCreateCommand, Guid> _handler;

    public CreateRoleEndpoint(ICommandHandler<RoleCreateCommand, Guid> handler) => _handler = handler;

    public override void Configure()
    {
        Post("create");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(RoleCreateCommand req, CancellationToken ct)
    {
        var uuid = await _handler.ExecuteAsync(req, ct);
        await Send.OkAsync(uuid, ct);
    }
}
