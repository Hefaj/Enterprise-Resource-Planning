using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Contracts;

// Strona odczytu CQRS. Interfejsy żyją tu, implementacje w Catalog.Infrastructure —
// dzięki temu warstwa Application nie zna EF Core (pilnuje tego Erp.ArchitectureTests),
// a endpointy w Catalog.Api zależą od abstrakcji, nie od dostawcy bazy.
//
// Zapytania świadomie OMIJAJĄ repozytoria i agregaty domenowe: rzutują wprost z tabel na DTO
// (`AsNoTracking` + projekcja). To jest cel rozdziału na komendy i zapytania, a nie skrót —
// materializowanie pełnych agregatów tylko po to, żeby zaraz spłaszczyć je do DTO, kosztuje
// przy listach po kilkaset pozycji i nie daje nic w zamian.

/// <summary>Odczyty produktów.</summary>
public interface IProductQueries
{
    Task<SearchResponse> SearchAsync(SearchProductRequest request, CancellationToken cancellationToken);

    Task<List<ProductDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>Identyfikatory produktów pasujących do filtra, bez stronicowania —
    /// używane przez operacje masowe do wyznaczenia zbioru celów.</summary>
    Task<List<Guid>> GetMatchingUuidsAsync(SearchProductRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Spośród podanych identyfikatorów zwraca te, które faktycznie istnieją jako produkty.
    ///
    /// Jedno zbiorcze zapytanie zamiast N osobnych <c>FindAsync</c> — używane przez
    /// walidację wsadową (<c>ProductMustExistRule</c>), która musi odsiać nieistniejące cele
    /// operacji masowej PRZED utworzeniem zadania, nie po jednym elemencie naraz.
    /// </summary>
    Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);

    /// <summary>
    /// Mapa: sygnatura duplikatu → produkt, który ją już zajmuje.
    ///
    /// Jedno zapytanie na cały wsad, tak samo jak <see cref="GetExistingUuidsAsync"/>.
    /// Sygnaturę liczy <c>Product.ComputeDuplicateKey</c>, więc wołający pyta o dokładnie te
    /// wartości, które trafią do kolumny przy zapisie — porównanie jest po skrócie, nie po
    /// modelu i kategoriach osobno, i dzięki temu nie wymaga joina z <c>product_category</c>.
    /// </summary>
    Task<Dictionary<string, Guid>> GetOwnersByDuplicateKeysAsync(
        IReadOnlyCollection<string> duplicateKeys,
        CancellationToken cancellationToken);
}
