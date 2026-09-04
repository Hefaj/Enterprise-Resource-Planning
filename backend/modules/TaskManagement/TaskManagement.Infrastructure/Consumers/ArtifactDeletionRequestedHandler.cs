using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using TaskManagement.Application;

namespace TaskManagement.Infrastructure.Consumers;

/// <summary>
/// Kasuje w magazynie plik, którego rekord właśnie zniknął z bazy (ATT-002) — wzorem
/// <c>Catalog.Infrastructure.Consumers.ArtifactDeletionRequestedHandler</c>
/// (<c>docs/guides/backend/media-storage.md</c> §4b).
/// </summary>
public static class ArtifactDeletionRequestedHandler
{
    public static async Task HandleAsync(
        ArtifactDeletionRequested message,
        IArtifactStoreResolver stores,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(stores);

        if (!string.Equals(message.Module, TaskManagementModule.Name, StringComparison.Ordinal))
        {
            return;
        }

        var store = stores.Resolve(message.StoreKey);

        await store.DeleteAsync(message.ArtifactUuid, cancellationToken).ConfigureAwait(false);
    }
}
