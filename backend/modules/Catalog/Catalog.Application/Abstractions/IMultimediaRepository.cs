using Catalog.Domain.Multimedia;

namespace Catalog.Application.Abstractions;

/// <summary>
/// Dostęp do agregatu <see cref="MultimediaAsset"/> po stronie zapisu.
///
/// <para><b>Wąski celowo.</b> Dziś jedyną komendą dotykającą tego agregatu jest jego utworzenie,
/// więc jest tu jedna metoda. Dopisywanie „na zapas” <c>FindAsync</c> czy <c>FindManyAsync</c>
/// dałoby martwy kod, którego pierwsze użycie i tak wymagałoby zastanowienia się nad zakresem
/// wczytania — porównaj <see cref="IProductRepository"/>, gdzie ten zakres jest osobnym pojęciem.</para>
///
/// <para>Brak <c>SaveAsync</c> jest regułą, nie przeoczeniem: granicę transakcji wyznacza
/// <c>IUnitOfWork</c>, żeby jedna komenda mogła dotknąć kilku agregatów naraz, a chunk operacji
/// masowej zatwierdzić się jednym commitem.</para>
/// </summary>
public interface IMultimediaRepository
{
    /// <summary>Dodaje nowy zasób do jednostki pracy.</summary>
    void Add(MultimediaAsset asset);
}
