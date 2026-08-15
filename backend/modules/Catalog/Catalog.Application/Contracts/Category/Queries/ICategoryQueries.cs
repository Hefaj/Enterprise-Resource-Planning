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

/// <summary>Odczyty kategorii, łącznie z widokami drzewiastymi.</summary>
public interface ICategoryQueries
{
    Task<SearchResponse> SearchAsync(SearchCategoryRequest request, CancellationToken cancellationToken);

    Task<List<CategoryDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    Task<GetCategoryChildrenResponse> GetChildrenAsync(
        GetCategoryChildrenRequest request,
        CancellationToken cancellationToken);

    Task<SearchCategoryTreeResponse> SearchTreeAsync(
        SearchCategoryTreeRequest request,
        CancellationToken cancellationToken);
}
