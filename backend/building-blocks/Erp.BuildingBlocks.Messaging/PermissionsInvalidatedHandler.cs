using Erp.BuildingBlocks.Application.Messaging;

namespace Erp.BuildingBlocks.Messaging;

/// <summary>
/// Odbiera broadcast <see cref="PermissionsInvalidated"/> i oddaje go lokalnym cache'om.
///
/// <para>Handler siedzi w warstwie komunikatów, a nie w module — sygnał dotyczy <b>każdego</b>
/// serwisu, który cache'uje uprawnienia, więc powielanie go w czterech modułach byłoby czterema
/// okazjami do pominięcia. Zestaw <c>Erp.BuildingBlocks.Messaging</c> jest z tego powodu
/// dopisywany do skanu Wolverine'a przez <see cref="ErpMessagingExtensions.AddErpMessaging"/>.</para>
///
/// <para><b>Metoda musi być publiczna i mieć wyłącznie jednoznacznie rozwiązywalne parametry</b> —
/// Wolverine wykrywa handlery refleksją i generuje dla nich kod. Metoda <c>internal</c> jest dla
/// niego niewidoczna, a parametr typu <c>IEnumerable&lt;T&gt;</c> odrzuca jako service location.
/// Oba błędy kończą się tak samo: handler nie uruchamia się nigdy, a jedynym śladem jest wpis
/// w logu przy starcie. Stąd jedna zależność (<see cref="PermissionCacheInvalidation"/>) zamiast
/// kolekcji.</para>
/// </summary>
public static class PermissionsInvalidatedHandler
{
    /// <summary>Handler komunikatu — sygnatura wykrywana konwencją Wolverine'a.</summary>
    public static Task HandleAsync(
        PermissionsInvalidated message,
        PermissionCacheInvalidation invalidation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(invalidation);

        return invalidation.ApplyAsync(message.UserId, cancellationToken);
    }
}
