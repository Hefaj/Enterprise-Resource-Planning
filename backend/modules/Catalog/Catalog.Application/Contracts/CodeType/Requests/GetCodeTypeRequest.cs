using System;
using System.Collections.Generic;

namespace Catalog.Application.Contracts;

/// <summary>Pobranie typów kodów po identyfikatorach; pusta lista = cały słownik.</summary>
public sealed class GetCodeTypeRequest
{
    public List<Guid>? Uuids { get; set; }
}
