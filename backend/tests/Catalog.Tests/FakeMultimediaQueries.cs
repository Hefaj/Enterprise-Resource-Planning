using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Tests;

/// <summary>
/// Odczyty multimediów w pamięci — na potrzeby reguły sprawdzającej, czy dopinany plik istnieje.
/// Metody spoza tej ścieżki celowo rzucają: test, który ich potrzebuje, ma to zauważyć.
/// </summary>
internal sealed class FakeMultimediaQueries : IMultimediaQueries
{
    /// <summary>Zasoby istniejące w „bazie”.</summary>
    public HashSet<Guid> ExistingUuids { get; init; } = [];

    /// <summary>Ile razy reguła odpytała bazę — ma to robić raz na cały wsad, nie raz na cel.</summary>
    public int ExistenceQueryCount { get; private set; }

    public Task<List<Guid>> GetExistingUuidsAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
    {
        ExistenceQueryCount++;

        return Task.FromResult(uuids.Where(ExistingUuids.Contains).ToList());
    }

    public Task<SearchResponse> SearchAsync(SearchMultimediaRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<MultimediaDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<Guid?> GetArtifactUuidAsync(Guid uuid, CancellationToken cancellationToken)
        => throw new NotSupportedException();
}
