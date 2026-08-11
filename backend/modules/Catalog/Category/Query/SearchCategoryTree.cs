using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Category.Query;

public class SearchCategoryTreeRequest
{
    public string? Search { get; set; }
}

public class SearchCategoryTreeResponse
{
    public List<CategoryTreeNodeDto> Matches { get; set; } = new();
    /// <summary>Przodkowie trafień (bez duplikatów), żeby front mógł pokazać wynik w kontekście
    /// hierarchii bez dodatkowych zapytań.</summary>
    public List<CategoryTreeNodeDto> Ancestors { get; set; } = new();
    public int TotalCount { get; set; }
}

/// <summary>
/// Wyszukiwanie kategorii po nazwie z kontekstem hierarchii (przodkowie trafień) — odpowiednik
/// docelowego `GET /api/catalog/categories/search-tree`. Używane przez `erp-tree-picker` do
/// wyszukiwania w drzewie kategorii bez znajomości pełnej ścieżki.
/// </summary>
public class SearchCategoryTreeEndpoint : Endpoint<SearchCategoryTreeRequest, SearchCategoryTreeResponse>
{
    public override void Configure()
    {
        Post("searchCategoryTree");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(SearchCategoryTreeRequest req, CancellationToken ct)
    {
        await CatalogMockData.SimulateQueryDelayAsync(ct);

        var term = req.Search?.Trim() ?? string.Empty;
        if (term.Length == 0)
        {
            await Send.OkAsync(new SearchCategoryTreeResponse(), ct);
            return;
        }

        var matches = CatalogMockData.Categories
            .Where(c => c.Name.Contains(term, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var ancestorUuids = new HashSet<Guid>();
        var ancestors = new List<CategoryDto>();
        foreach (var match in matches)
        {
            foreach (var ancestor in CategoryTreeNodeMapper.AncestorsOf(match.Uuid))
            {
                if (ancestorUuids.Add(ancestor.Uuid))
                    ancestors.Add(ancestor);
            }
        }

        await Send.OkAsync(new SearchCategoryTreeResponse
        {
            Matches = matches.Select(CategoryTreeNodeMapper.ToNode).ToList(),
            Ancestors = ancestors.Select(CategoryTreeNodeMapper.ToNode).ToList(),
            TotalCount = matches.Count,
        }, ct);
    }
}
