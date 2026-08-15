using System;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Codes;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`).

/// <summary>Filtry wyszukiwania typów kodów.</summary>
public sealed class SearchCodeTypeRequest : PagedRequest
{
    public Guid? CodeTypeId { get; set; }

    /// <summary>Fragment symbolu (<c>EAN</c>) albo nazwy.</summary>
    public string? Name { get; set; }
}
