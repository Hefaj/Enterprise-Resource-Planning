using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Categories;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`). Dodatkowo `SearchProductRequest` pełni
// rolę filtra celu w operacjach masowych (`BatchCommand<TCommand, TFilter>`), więc jego kształt
// jest widoczny w nazwie wygenerowanego typu po stronie klienta.

/// <summary>Filtry wyszukiwania kategorii.</summary>
public sealed class SearchCategoryRequest : PagedRequest
{
    public string? Name { get; set; }
}
