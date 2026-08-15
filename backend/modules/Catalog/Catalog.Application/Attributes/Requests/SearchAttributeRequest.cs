using System;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Attributes;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`).

/// <summary>Filtry wyszukiwania definicji atrybutów.</summary>
public sealed class SearchAttributeRequest : PagedRequest
{
    public Guid? AttributeId { get; set; }

    /// <summary>Fragment symbolu (<c>COLOR</c>) albo nazwy.</summary>
    public string? Name { get; set; }

    /// <summary>Rodzaj atrybutu: <c>Dictionary</c>, <c>Value</c> albo <c>Multimedia</c>.</summary>
    public string? Kind { get; set; }
}
