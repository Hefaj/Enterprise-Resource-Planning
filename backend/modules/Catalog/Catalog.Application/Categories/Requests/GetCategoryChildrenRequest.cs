using System;

namespace Catalog.Application.Categories;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`). Dodatkowo `SearchProductRequest` pełni
// rolę filtra celu w operacjach masowych (`BatchCommand<TCommand, TFilter>`), więc jego kształt
// jest widoczny w nazwie wygenerowanego typu po stronie klienta.

/// <summary>Stronicowane pobranie dzieci węzła drzewa kategorii.</summary>
public sealed class GetCategoryChildrenRequest
{
    /// <summary>Rodzic; <c>null</c> oznacza korzenie drzewa.</summary>
    public Guid? ParentUuid { get; set; }

    public int PageIndex { get; set; }

    public int PageSize { get; set; } = 50;
}
