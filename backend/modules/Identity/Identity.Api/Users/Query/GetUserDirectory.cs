using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Query;

/// <summary>
/// Pozycje katalogu po identyfikatorach — zamiana uuidów na nazwiska.
///
/// <para>Wraca <b>także konto nieaktywne</b>: przypisanie sprzed roku albo autor komentarza
/// z zeszłego kwartału muszą wyświetlić się nazwiskiem również wtedy, gdy ta osoba nie pracuje
/// już w firmie. Ukrywanie ich zamieniłoby historię w listę uuidów — czyli dokładnie ten stan,
/// który ten endpoint likwiduje.</para>
///
/// <para>Za samym uwierzytelnieniem — uzasadnienie przy
/// <see cref="SearchUserDirectoryEndpoint"/>.</para>
/// </summary>
public sealed class GetUserDirectoryEndpoint : Endpoint<GetUserDirectoryRequest, List<UserDirectoryDto>>
{
    private readonly IUserDirectoryQueries _queries;

    public GetUserDirectoryEndpoint(IUserDirectoryQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getUserDirectory");
        Group<UserGroup>();
        Description(d => d.WithSummary("Pozycje katalogu użytkowników po identyfikatorach"));
    }

    public override async Task HandleAsync(GetUserDirectoryRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var users = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(users, ct);
    }
}
