using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Users;

namespace Identity.Tests;

/// <summary>
/// Podstawka pod reguły wsadowe użytkowników. Ręcznie, bez biblioteki mockującej — patrz
/// uzasadnienie przy <c>Catalog.Tests.FakeProductQueries</c>.
/// </summary>
internal sealed class FakeUserAccountQueries : IUserAccountQueries
{
    /// <summary>Użytkownicy istniejący w „bazie”.</summary>
    public HashSet<Guid> ExistingUuids { get; init; } = [];

    public Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken)
        => Task.FromResult(uuids.Where(ExistingUuids.Contains).ToList());

    public Task<SearchResponse> SearchAsync(SearchUserAccountRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<UserAccountDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<Guid>> GetMatchingUuidsAsync(SearchUserAccountRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<HashSet<string>> GetEffectivePermissionCodesAsync(Guid userUuid, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<EffectivePermissionSourceDto>> GetEffectivePermissionSourcesAsync(Guid userUuid, CancellationToken cancellationToken)
        => throw new NotSupportedException();
}
