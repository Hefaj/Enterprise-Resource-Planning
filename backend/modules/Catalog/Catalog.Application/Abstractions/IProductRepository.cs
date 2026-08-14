using Catalog.Domain.Products;

namespace Catalog.Application.Abstractions;

/// <summary>
/// Dostęp do agregatu <see cref="Product"/> po stronie zapisu.
///
/// Repozytorium istnieje wyłącznie dla strony komend i zwraca pełne agregaty ze śledzeniem
/// zmian — inaczej metody domenowe nie miałyby czego modyfikować. Strona odczytu świadomie
/// go NIE używa (patrz <c>IProductQueries</c>): tam materializowanie agregatu tylko po to,
/// by spłaszczyć go do DTO, byłoby czystą stratą.
///
/// Brak tu metody <c>SaveAsync</c> — zapis należy do <c>IUnitOfWork</c>, żeby jedna komenda
/// mogła dotknąć kilku agregatów w jednej transakcji, a operacja masowa zatwierdzić cały chunk
/// jednym commitem.
/// </summary>
public interface IProductRepository
{
    /// <summary>Wczytuje produkt do modyfikacji.</summary>
    /// <returns><c>null</c>, jeśli produkt nie istnieje.</returns>
    Task<Product?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>Wczytuje wiele produktów naraz — jedno zapytanie zamiast N przy operacjach masowych.</summary>
    Task<List<Product>> FindManyAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);

    /// <summary>Dodaje nowy produkt do jednostki pracy.</summary>
    void Add(Product product);
}
