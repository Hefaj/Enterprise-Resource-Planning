using Catalog.Domain.Multimedia;

namespace Catalog.Application.Abstractions;

/// <summary>
/// Dostęp do agregatu <see cref="MultimediaAsset"/> po stronie zapisu.
///
/// <para><b>Wąski celowo.</b> Są tu wyłącznie operacje, których używa istniejąca komenda.
/// Dopisywanie „na zapas” <c>FindManyAsync</c> dałoby martwy kod, którego pierwsze użycie i tak
/// wymagałoby zastanowienia się nad zakresem wczytania — porównaj <see cref="IProductRepository"/>,
/// gdzie ten zakres jest osobnym pojęciem. Agregat multimediów zakresu nie ma: nie posiada
/// kolekcji, więc wczytuje się w całości albo wcale.</para>
///
/// <para>Brak <c>SaveAsync</c> jest regułą, nie przeoczeniem: granicę transakcji wyznacza
/// <c>IUnitOfWork</c>, żeby jedna komenda mogła dotknąć kilku agregatów naraz, a chunk operacji
/// masowej zatwierdzić się jednym commitem.</para>
/// </summary>
public interface IMultimediaRepository
{
    /// <summary>Dodaje nowy zasób do jednostki pracy.</summary>
    void Add(MultimediaAsset asset);

    /// <summary>Wczytuje zasób ze śledzeniem zmian; <c>null</c>, gdy nie istnieje.</summary>
    Task<MultimediaAsset?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>
    /// Wczytuje ze śledzeniem zmian te z podanych zasobów, które istnieją.
    ///
    /// <para>Jedno zapytanie na wsad, bo woła to kaskada domykająca odpięcie multimediów —
    /// przy podmianie galerii produktu kandydatów bywa kilkanaście, a pytanie per zasób dałoby
    /// tyle round-tripów, ile plików.</para>
    /// </summary>
    Task<List<MultimediaAsset>> FindManyAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken);

    /// <summary>Oznacza zasób do usunięcia w bieżącej jednostce pracy.</summary>
    void Remove(MultimediaAsset asset);
}
