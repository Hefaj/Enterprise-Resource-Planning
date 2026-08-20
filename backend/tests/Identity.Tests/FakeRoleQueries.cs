using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Roles;

namespace Identity.Tests;

/// <summary>
/// Podstawka pod reguły wsadowe ról. Ręcznie, bez biblioteki mockującej — patrz uzasadnienie
/// przy <c>Catalog.Tests.FakeProductQueries</c>.
/// </summary>
internal sealed class FakeRoleQueries : IRoleQueries
{
    /// <summary>Role istniejące w „bazie”.</summary>
    public HashSet<Guid> ExistingUuids { get; init; } = [];

    /// <summary>Kody ról już zajęte w „bazie” — WEJŚCIOWA (nieznormalizowana) forma, jak
    /// prawdziwa implementacja normalizuje przed porównaniem.</summary>
    public HashSet<string> ExistingCodes { get; init; } = new(StringComparer.Ordinal);

    /// <summary>Krawędzie <c>role_member</c> istniejące w „bazie” (zacommitowany stan).</summary>
    public List<RoleMembershipEdge> MembershipEdges { get; init; } = [];

    /// <summary>Ile razy reguła odpytała o krawędzie grafu — ma to robić raz na wsad.</summary>
    public int MembershipEdgesQueryCount { get; private set; }

    public Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken)
        => Task.FromResult(uuids.Where(ExistingUuids.Contains).ToList());

    public Task<List<string>> GetExistingCodesAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken)
    {
        var normalized = new HashSet<string>(ExistingCodes.Select(c => c.Trim().ToLowerInvariant()), StringComparer.Ordinal);
        return Task.FromResult(codes.Where(normalized.Contains).ToList());
    }

    public Task<List<RoleMembershipEdge>> GetAllMembershipEdgesAsync(CancellationToken cancellationToken)
    {
        MembershipEdgesQueryCount++;
        return Task.FromResult(MembershipEdges);
    }

    public Task<SearchResponse> SearchAsync(SearchRoleRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<RoleDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<Guid>> GetMatchingUuidsAsync(SearchRoleRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<bool> IsDescendantAsync(Guid ancestorRoleUuid, Guid roleUuid, CancellationToken cancellationToken)
        => throw new NotSupportedException();
}
