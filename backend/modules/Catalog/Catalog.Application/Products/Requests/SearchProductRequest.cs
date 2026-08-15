using System;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Products;

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

    /// <summary>Atrybut, po którego wartości filtrujemy; wymagany dla <see cref="AttributeOptionId"/>.</summary>
    public Guid? AttributeId { get; set; }

    /// <summary>Wybrana pozycja słownika atrybutu — filtr „produkty w kolorze czarnym”.</summary>
    public Guid? AttributeOptionId { get; set; }

    /// <summary>Fragment wartości kodu produktu — dowolnego typu, o ile nie zawężono
    /// go przez <see cref="CodeTypeId"/>.</summary>
    public string? ProductCode { get; set; }

    /// <summary>Zawęża <see cref="ProductCode"/> do jednego typu ze słownika.</summary>
    public Guid? CodeTypeId { get; set; }

    public string? TerritoryCode { get; set; }

    public bool? SummaryReport { get; set; }
}
