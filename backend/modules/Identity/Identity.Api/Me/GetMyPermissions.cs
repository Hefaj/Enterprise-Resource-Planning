using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Me;

/// <summary>
/// Efektywny zbiór uprawnień zalogowanego użytkownika — front ładuje to raz w <c>STARTUP.ts</c>
/// (patrz <c>docs/backend/identity-authz.md</c> §6, <c>PermissionStore</c>). Tożsamość
/// wyłącznie z <c>context.User</c> (przez <see cref="IExecutionContext"/>) — nie z parametru
/// URL, żeby nie dało się odpytać o cudze uprawnienia przez samą zmianę id w żądaniu.
/// </summary>
public sealed class GetMyPermissionsEndpoint : EndpointWithoutRequest<List<string>>
{
    private readonly IExecutionContext _executionContext;
    private readonly IUserAccountQueries _queries;

    public GetMyPermissionsEndpoint(IExecutionContext executionContext, IUserAccountQueries queries)
    {
        _executionContext = executionContext;
        _queries = queries;
    }

    public override void Configure()
    {
        Get("/me/permissions");
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(_executionContext.UserId, out var userUuid))
        {
            await Send.OkAsync([], ct);
            return;
        }

        var codes = await _queries.GetEffectivePermissionCodesAsync(userUuid, ct);
        await Send.OkAsync(codes.ToList(), ct);
    }
}
