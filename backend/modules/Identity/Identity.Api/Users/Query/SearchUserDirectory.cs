using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Identity.Application.Users;

namespace Identity.Users.Query;

/// <summary>
/// Wyszukiwanie w katalogu użytkowników — zasila picker przypisania w każdym module.
///
/// <para><b>Za samym uwierzytelnieniem, bez kodu uprawnienia</b>, i to jest decyzja, nie
/// przeoczenie. Katalog to imiona, nazwiska i adresy służbowe — książka telefoniczna firmy.
/// Żeby przypisać komuś zgłoszenie albo wskazać akceptującego dokument, trzeba go najpierw
/// zobaczyć; bramka na uprawnieniu oznaczałaby, że zwykły członek zespołu widzi pusty picker,
/// bo ról nikt mu jeszcze nie nadał (seed zakłada wyłącznie rolę <c>administrator</c>).</para>
///
/// <para><b>Co ZOSTAJE za uprawnieniem:</b> nadania ról i uprawnień, historia nadań, wymuszone
/// wylogowanie — czyli wszystko, co wystawia <c>searchUser</c>/<c>getUser</c> pod
/// <c>identity.user.read</c> i <c>identity.user.manage</c>. Ten endpoint celowo nie wozi
/// niczego z tej listy (patrz <see cref="UserDirectoryDto"/>).</para>
/// </summary>
public sealed class SearchUserDirectoryEndpoint : Endpoint<SearchUserDirectoryRequest, SearchResponse>
{
    private readonly IUserDirectoryQueries _queries;

    public SearchUserDirectoryEndpoint(IUserDirectoryQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchUserDirectory");
        Group<UserGroup>();
        Description(d => d
            .WithSummary("Wyszukiwanie w katalogu użytkowników")
            .WithDescription(
                "Zwraca identyfikatory pasujące do frazy (nazwa wyświetlana albo e-mail). "
                + "Nazwy pobiera się potem przez `user/getUserDirectory` — ten sam kontrakt "
                + "co `searchFn`/`getFn` pickera po stronie frontu."));
    }

    public override async Task HandleAsync(SearchUserDirectoryRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
