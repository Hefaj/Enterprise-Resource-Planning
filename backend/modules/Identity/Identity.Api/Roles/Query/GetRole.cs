using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Query;

/// <summary>Pobranie ról po identyfikatorach.</summary>
public sealed class GetRoleEndpoint : Endpoint<GetRoleRequest, List<RoleDto>>
{
    private readonly IRoleQueries _queries;

    public GetRoleEndpoint(IRoleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getRole");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(GetRoleRequest req, CancellationToken ct)
    {
        var roles = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(roles, ct);
    }
}
