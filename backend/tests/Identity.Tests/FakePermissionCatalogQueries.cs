using Identity.Application.Permissions;

namespace Identity.Tests;

/// <summary>
/// Podstawka pod <c>PermissionCodeMustExistRule</c>. Ręcznie, bez biblioteki mockującej —
/// patrz uzasadnienie przy <c>Catalog.Tests.FakeProductQueries</c>.
/// </summary>
internal sealed class FakePermissionCatalogQueries : IPermissionCatalogQueries
{
    /// <summary>Kody istniejące w katalogu i NIE oznaczone jako wycofane.</summary>
    public HashSet<string> ExistingCodes { get; init; } = new(StringComparer.Ordinal);

    public Task<List<string>> GetExistingCodesAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken)
        => Task.FromResult(codes.Where(ExistingCodes.Contains).ToList());

    public Task<List<PermissionCatalogEntryDto>> GetAllAsync(CancellationToken cancellationToken)
        => throw new NotSupportedException();
}
