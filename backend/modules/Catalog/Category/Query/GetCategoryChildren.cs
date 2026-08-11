using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Category.Query;

public class GetCategoryChildrenRequest
{
    /// <summary>Rodzic, którego bezpośrednie dzieci mają zostać zwrócone. `null` = korzenie drzewa.</summary>
    public Guid? ParentUuid { get; set; }
    public int PageIndex { get; set; } = 0;
    public int PageSize { get; set; } = 50;
}

public class GetCategoryChildrenResponse
{
    public List<CategoryTreeNodeDto> Nodes { get; set; } = new();
    public int TotalCount { get; set; }
}

/// <summary>
/// Leniwe doładowywanie dzieci węzła w `erp-tree` (tryb server) — odpowiednik docelowego
/// `GET /api/catalog/categories/children` opisanego niegdyś w (usuniętym po tej migracji)
/// frontendowym `category-tree.mock-data.ts`.
///
/// Docelowo (realna baza): tabela domknięcia `CategoryClosure(AncestorUuid, DescendantUuid, Depth)`
/// obok `Category` pozwala odpowiedzieć jednym tanim zapytaniem zarówno "dzieci X" (Depth=1), jak
/// i "wszyscy potomkowie X" (dowolny Depth), bez limitu parametrów SQL — zapytania filtrują po
/// AncestorUuid (garść wartości), nie po wypisanej liście DescendantUuid (potencjalnie tysiące).
/// </summary>
public class GetCategoryChildrenEndpoint : Endpoint<GetCategoryChildrenRequest, GetCategoryChildrenResponse>
{
    public override void Configure()
    {
        Post("getCategoryChildren");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(GetCategoryChildrenRequest req, CancellationToken ct)
    {
        await CatalogMockData.SimulateQueryDelayAsync(ct);

        var all = CatalogMockData.CategoryChildren[req.ParentUuid]
            .OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var page = all
            .Skip(req.PageIndex * req.PageSize)
            .Take(req.PageSize)
            .Select(CategoryTreeNodeMapper.ToNode)
            .ToList();

        await Send.OkAsync(new GetCategoryChildrenResponse { Nodes = page, TotalCount = all.Count }, ct);
    }
}
