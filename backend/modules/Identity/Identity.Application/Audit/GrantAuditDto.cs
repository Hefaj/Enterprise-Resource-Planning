using Erp.BuildingBlocks.Api.Contracts;

namespace Identity.Application.Audit;

/// <summary>Wpis dziennika audytowego w widoku odczytu.</summary>
public sealed record GrantAuditDto(
    Guid Uuid,
    DateTimeOffset OccurredAt,
    Guid ActorUserUuid,
    string SubjectType,
    Guid SubjectUuid,
    string Action,
    string TargetCode,
    string? Reason,
    string Source);

/// <summary>Filtry wyszukiwania wpisów audytu.</summary>
public sealed class SearchGrantAuditRequest : PagedRequest
{
    public Guid? SubjectUuid { get; set; }

    public string? SubjectType { get; set; }

    public string? Action { get; set; }
}

/// <summary>Pobranie wpisów audytu po identyfikatorach.</summary>
public sealed class GetGrantAuditRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Odczyty dziennika audytowego. Implementacja w <c>Identity.Infrastructure</c>.
/// Ten sam wzorzec „szukaj → pobierz" co <c>IRoleQueries</c>/<c>IUserAccountQueries</c>.</summary>
public interface IGrantAuditQueries
{
    Task<SearchResponse> SearchAsync(SearchGrantAuditRequest request, CancellationToken cancellationToken);

    Task<List<GrantAuditDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}
