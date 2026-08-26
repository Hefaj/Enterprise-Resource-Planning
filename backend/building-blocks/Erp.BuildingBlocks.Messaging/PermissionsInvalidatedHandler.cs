using Erp.BuildingBlocks.Application.Messaging;

namespace Erp.BuildingBlocks.Messaging;

/// <summary>
/// Odbiera broadcast <see cref="PermissionsInvalidated"/> i rozdaje go lokalnym cache'om.
///
/// <para>Handler siedzi w warstwie komunikatów, a nie w module — sygnał dotyczy <b>każdego</b>
/// serwisu, który cache'uje uprawnienia, więc powielanie go w czterech modułach byłoby czterema
/// okazjami do pominięcia. Zestaw <c>Erp.BuildingBlocks.Messaging</c> jest z tego powodu
/// dopisywany do skanu Wolverine'a przez <see cref="ErpMessagingExtensions.AddErpMessaging"/>.</para>
///
/// <para>Serwis bez cache'u uprawnień nie rejestruje żadnego <see cref="IPermissionCacheInvalidator"/>
/// i handler nie robi wtedy nic — pusta kolekcja, nie wyjątek.</para>
/// </summary>
public sealed class PermissionsInvalidatedHandler
{
    /// <summary>Handler komunikatu — sygnatura wykrywana konwencją Wolverine'a.</summary>
    public static async Task HandleAsync(
        PermissionsInvalidated message,
        IEnumerable<IPermissionCacheInvalidator> invalidators,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(invalidators);

        foreach (var invalidator in invalidators)
        {
            await invalidator.InvalidateAsync(message.UserId, cancellationToken).ConfigureAwait(false);
        }
    }
}
