using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Query;

public sealed class GetUserEndpoint : Endpoint<GetUserAccountRequest, List<UserAccountDto>>
{
    private readonly IUserAccountQueries _queries;

    public GetUserEndpoint(IUserAccountQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getUser");
        Group<UserGroup>();
    }

    public override async Task HandleAsync(GetUserAccountRequest req, CancellationToken ct)
    {
        var users = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(users, ct);
    }
}
