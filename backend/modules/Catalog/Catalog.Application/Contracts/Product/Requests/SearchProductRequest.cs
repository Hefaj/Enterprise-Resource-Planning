using System;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Contracts;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`). Dodatkowo `SearchProductRequest` pełni
// rolę filtra celu w operacjach masowych (`BatchCommand<TCommand, TFilter>`), więc jego kształt
// jest widoczny w nazwie wygenerowanego typu po stronie klienta.

/// <summary>Filtry wyszukiwania produktów.</summary>
public sealed class SearchProductRequest : PagedRequest
{
    public Guid? ProductId { get; set; }

    public Guid? ModelId { get; set; }

    public string? ProductType { get; set; }

    public string? Manufacturer { get; set; }

    public string? Model { get; set; }

    /// <summary>Zaznaczenie w drzewie kategorii — deskryptor, nie płaska lista identyfikatorów.</summary>
    public TreeSelectionRequest? Category { get; set; }

    public string? Attribute { get; set; }

    /// <summary>Fragment SKU lub EAN.</summary>
    public string? ProductCode { get; set; }

    public string? TerritoryCode { get; set; }

    public bool? SummaryReport { get; set; }
}
