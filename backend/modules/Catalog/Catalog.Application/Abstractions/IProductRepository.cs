using Catalog.Domain.Products;

namespace Catalog.Application.Abstractions;

/// <summary>
/// Ile agregatu <see cref="Product"/> trzeba wczytać, żeby komenda mogła się bezpiecznie wykonać.
///
/// <para>Istnieje, bo pełny produkt to sześć zapytań (korzeń + pięć kolekcji rozbitych przez
/// globalne <c>SplitQuery</c>), a większość komend nie dotyka ani jednej kolekcji. Przy operacji
/// masowej na 50 tys. pozycji ta różnica przestaje być teoretyczna.</para>
///
/// <para><b>Kolejność wartości jest częścią kontraktu</b> — repozytorium porównuje zakresy
/// relacją „co najmniej tyle” (<c>Full</c> zaspokaja żądanie o <c>Root</c>, odwrotnie nie).
/// Nowa wartość musi trafić w to uporządkowanie, od najwęższej do najszerszej.</para>
/// </summary>
public enum ProductLoadScope
{
    /// <summary>
    /// Sam korzeń — wiersz tabeli <c>product</c>, bez kolekcji wewnętrznych.
    ///
    /// <para>Wystarcza komendom zmieniającym wyłącznie kolumny produktu
    /// (<c>SetName</c>, <c>SetPrice</c>, <c>SetStatus</c>). <b>Nie wolno</b> podawać agregatu
    /// wczytanego w tym zakresie metodzie, która podmienia kolekcję — <c>SetClassification</c>
    /// czy <c>SetCodes</c> zobaczyłyby pustkę zamiast istniejących powiązań i po cichu dopisały
    /// nowe obok starych zamiast je zastąpić. Repozytorium pilnuje tego samo: przy zbyt wąskim
    /// wczytaniu z góry schodzi do pełnego zapytania, zamiast oddać agregat-kadłubek.</para>
    /// </summary>
    Root = 0,

    /// <summary>Korzeń wraz z kompletem kolekcji wewnętrznych — kategorie, multimedia,
    /// gwarancje, kody, wartości atrybutów. Wymagany przez każdą komendę dotykającą powiązań.</summary>
    Full = 1,
}

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
    /// <summary>Wczytuje pełny produkt do modyfikacji.</summary>
    /// <returns><c>null</c>, jeśli produkt nie istnieje.</returns>
    Task<Product?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    /// <summary>
    /// Wczytuje produkt w podanym zakresie. Komenda dotykająca samego korzenia płaci wtedy
    /// za jedno zapytanie zamiast za sześć.
    /// </summary>
    /// <param name="uuid">Produkt do wczytania.</param>
    /// <param name="scope">Ile agregatu potrzebuje metoda domenowa, która go dostanie.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    /// <returns><c>null</c>, jeśli produkt nie istnieje.</returns>
    Task<Product?> FindAsync(Guid uuid, ProductLoadScope scope, CancellationToken cancellationToken);

    /// <summary>Wczytuje wiele produktów naraz — jedno zapytanie zamiast N przy operacjach masowych.</summary>
    Task<List<Product>> FindManyAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);

    /// <summary>
    /// Wciąga wskazane produkty do jednostki pracy z góry, żeby kolejne wywołania
    /// <see cref="FindAsync(Guid, ProductLoadScope, CancellationToken)"/> w tym samym scope
    /// obsłużyły się z pamięci kontekstu, bez odpytywania bazy.
    ///
    /// <para>Wywołuje to <c>BulkCommandRunner</c> raz na chunk (patrz
    /// <c>IBulkPreloadingHandler</c>). Poprawność od tego nie zależy — bez wczytania z góry
    /// <see cref="FindAsync(Guid, ProductLoadScope, CancellationToken)"/> po prostu odpyta bazę.</para>
    /// </summary>
    /// <param name="uuids">Produkty do wczytania.</param>
    /// <param name="scope">Zakres, w jakim mają zostać wczytane.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task PreloadAsync(
        IReadOnlyCollection<Guid> uuids,
        ProductLoadScope scope,
        CancellationToken cancellationToken);

    /// <summary>Dodaje nowy produkt do jednostki pracy.</summary>
    void Add(Product product);
}
