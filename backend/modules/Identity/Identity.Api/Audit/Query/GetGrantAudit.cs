using FastEndpoints;
using Identity.Application.Audit;

namespace Identity.Audit.Query;

/// <summary>Pobranie wpisów audytu po identyfikatorach — druga połowa wzorca „szukaj → pobierz"
/// (patrz <see cref="SearchGrantAuditEndpoint"/>).</summary>
public sealed class GetGrantAuditEndpoint : Endpoint<GetGrantAuditRequest, List<GrantAuditDto>>
{
    private readonly IGrantAuditQueries _queries;

    public GetGrantAuditEndpoint(IGrantAuditQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getGrantAudit");
        Group<AuditGroup>();
    }

    public override async Task HandleAsync(GetGrantAuditRequest req, CancellationToken ct)
    {
        var entries = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(entries, ct);
    }
}
