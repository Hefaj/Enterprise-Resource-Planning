using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Query;

public sealed class SearchUserEndpoint : Endpoint<SearchUserAccountRequest, SearchResponse>
{
    private readonly IUserAccountQueries _queries;

    public SearchUserEndpoint(IUserAccountQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchUser");
        Group<UserGroup>();
    }

    public override async Task HandleAsync(SearchUserAccountRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
