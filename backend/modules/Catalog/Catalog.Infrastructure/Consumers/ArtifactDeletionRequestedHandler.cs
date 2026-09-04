using Catalog.Application;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;

namespace Catalog.Infrastructure.Consumers;

/// <summary>
/// Kasuje w magazynie plik, którego rekord właśnie zniknął z bazy.
///
/// <para><b>Dlaczego to jest konsument, a nie wywołanie w handlerze komendy.</b> Baza i magazyn
/// nie są w jednej transakcji. Koperta zapisuje się razem z usunięciem wiersza, więc rollback
/// zabiera ją ze sobą, a padnięcie magazynu odkłada tylko dostarczenie — nie gubi go. Ponowienie
/// jest bezpieczne: <c>DeleteAsync</c> traktuje brak obiektu jako sukces, bo o to wołającemu
/// chodziło (<c>docs/guides/backend/media-storage.md</c> §4b).</para>
///
/// <para><b>Filtr po module jest obowiązkowy, nie ostrożnościowy.</b> Wymiana <c>erp.events</c>
/// jest fanoutowa — tę kopertę dostają wszystkie mikroserwisy, a każdy ma własne kubełki.
/// Bez tego sprawdzenia Catalog kasowałby u siebie obiekt o identyfikatorze podanym przez
/// sąsiada.</para>
///
/// <para>Magazyn wybieramy <b>po kluczu z koperty</b>, a nie na sztywno: moduł ma ich kilka
/// i plik trzeba skasować w tym, w którym leży. Przez <see cref="IArtifactStoreResolver"/>,
/// nie przez wstrzyknięty kontener — uzasadnienie przy samej abstrakcji.</para>
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

        if (!string.Equals(message.Module, CatalogModule.Name, StringComparison.Ordinal))
        {
            return;
        }

        var store = stores.Resolve(message.StoreKey);

        await store.DeleteAsync(message.ArtifactUuid, cancellationToken).ConfigureAwait(false);
    }
}
