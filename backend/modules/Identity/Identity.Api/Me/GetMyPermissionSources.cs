using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Me;

/// <summary>Efektywne uprawnienia zalogowanego użytkownika Z ROZWINIĘCIEM ŹRÓDŁA — zasila
/// ekran "skąd to uprawnienie" (Faza 4, patrz <c>docs/architecture/security.md</c> §6).
/// Osobny endpoint od <see cref="GetMyPermissionsEndpoint"/>: ten zwraca więcej danych niż
/// front potrzebuje na starcie (<c>PermissionStore</c> chce tylko płaskiej listy kodów).</summary>
public sealed class GetMyPermissionSourcesEndpoint : EndpointWithoutRequest<List<EffectivePermissionSourceDto>>
{
    private readonly IExecutionContext _executionContext;
    private readonly IUserAccountQueries _queries;

    public GetMyPermissionSourcesEndpoint(IExecutionContext executionContext, IUserAccountQueries queries)
    {
        _executionContext = executionContext;
        _queries = queries;
    }

    public override void Configure()
    {
        Get("/me/permissions/sources");
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(_executionContext.UserId, out var userUuid))
        {
            await Send.OkAsync([], ct);
            return;
        }

        var sources = await _queries.GetEffectivePermissionSourcesAsync(userUuid, ct);
        await Send.OkAsync(sources, ct);
    }
}
