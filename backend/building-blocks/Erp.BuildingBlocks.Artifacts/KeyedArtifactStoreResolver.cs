using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Artifacts;

/// <summary>
/// <see cref="IArtifactStoreResolver"/> nad rejestracjami kluczowanymi kontenera — jedyne
/// miejsce w systemie, w którym sięgnięcie po <see cref="IServiceProvider"/> jest zamierzone.
///
/// <para>Magazyny są singletonami (patrz <see cref="ErpArtifactExtensions.AddErpArtifacts"/>),
/// więc resolver też nim jest i nie ma potrzeby wiązać go z zakresem żądania.</para>
/// </summary>
public sealed class KeyedArtifactStoreResolver : IArtifactStoreResolver
{
    private readonly IServiceProvider _services;

    public KeyedArtifactStoreResolver(IServiceProvider services)
    {
        _services = services;
    }

    /// <inheritdoc />
    public IArtifactStore Resolve(string storeKey)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(storeKey);

        return _services.GetRequiredKeyedService<IArtifactStore>(storeKey);
    }
}
