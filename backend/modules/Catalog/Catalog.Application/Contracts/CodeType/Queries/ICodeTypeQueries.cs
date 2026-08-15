using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Contracts;

// Strona odczytu CQRS. Interfejsy żyją tu, implementacje w Catalog.Infrastructure —
// dzięki temu warstwa Application nie zna EF Core (pilnuje tego Erp.ArchitectureTests).

/// <summary>Odczyty słownika typów kodów.</summary>
public interface ICodeTypeQueries
{
    Task<SearchResponse> SearchAsync(SearchCodeTypeRequest request, CancellationToken cancellationToken);

    Task<List<CodeTypeDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}
