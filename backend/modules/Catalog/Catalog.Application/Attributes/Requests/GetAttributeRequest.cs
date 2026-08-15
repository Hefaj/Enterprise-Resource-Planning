using System;
using System.Collections.Generic;

namespace Catalog.Application.Attributes;

/// <summary>Pobranie definicji atrybutów po identyfikatorach; pusta lista = cały słownik.</summary>
public sealed class GetAttributeRequest
{
    public List<Guid>? Uuids { get; set; }
}
