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

/// <summary>Pobranie produktów po identyfikatorach.</summary>
public sealed class GetProductRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Filtry wyszukiwania kategorii.</summary>
public sealed class SearchCategoryRequest : PagedRequest
{
    public string? Name { get; set; }
}

/// <summary>Pobranie kategorii po identyfikatorach.</summary>
public sealed class GetCategoryRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Stronicowane pobranie dzieci węzła drzewa kategorii.</summary>
public sealed class GetCategoryChildrenRequest
{
    /// <summary>Rodzic; <c>null</c> oznacza korzenie drzewa.</summary>
    public Guid? ParentUuid { get; set; }

    public int PageIndex { get; set; }

    public int PageSize { get; set; } = 50;
}

/// <summary>Wyszukiwanie w drzewie kategorii z kontekstem hierarchii.</summary>
public sealed class SearchCategoryTreeRequest
{
    public string? Search { get; set; }
}

/// <summary>Filtry wyszukiwania modeli.</summary>
public sealed class SearchModelRequest : PagedRequest
{
    public string? Name { get; set; }
}

/// <summary>Pobranie modeli po identyfikatorach.</summary>
public sealed class GetModelRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Filtry wyszukiwania multimediów.</summary>
public sealed class SearchMultimediaRequest : PagedRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Pobranie multimediów po identyfikatorach.</summary>
public sealed class GetMultimediaRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Filtry wyszukiwania gwarancji.</summary>
public sealed class SearchWarrantyRequest : PagedRequest
{
    public Guid? WarrantyId { get; set; }

    public string? Name { get; set; }
}

/// <summary>Pobranie gwarancji po identyfikatorach.</summary>
public sealed class GetWarrantyRequest
{
    public List<Guid>? Uuids { get; set; }
}
