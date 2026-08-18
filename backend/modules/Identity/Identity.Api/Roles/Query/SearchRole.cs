using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Identity.Application.Roles;

namespace Identity.Roles.Query;

/// <summary>Wyszukiwanie ról — identyfikatory i licznik, ten sam wzorzec „szukaj → pobierz”
/// co pozostałe moduły.</summary>
public sealed class SearchRoleEndpoint : Endpoint<SearchRoleRequest, SearchResponse>
{
    private readonly IRoleQueries _queries;

    public SearchRoleEndpoint(IRoleQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchRole");
        Group<RoleGroup>();
    }

    public override async Task HandleAsync(SearchRoleRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
