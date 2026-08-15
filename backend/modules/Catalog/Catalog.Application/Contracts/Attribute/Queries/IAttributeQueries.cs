using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Contracts;

// Strona odczytu CQRS. Interfejsy żyją tu, implementacje w Catalog.Infrastructure —
// dzięki temu warstwa Application nie zna EF Core (pilnuje tego Erp.ArchitectureTests).

/// <summary>Odczyty słownika definicji atrybutów.</summary>
public interface IAttributeQueries
{
    Task<SearchResponse> SearchAsync(SearchAttributeRequest request, CancellationToken cancellationToken);

    Task<List<AttributeDefinitionDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken);
}
