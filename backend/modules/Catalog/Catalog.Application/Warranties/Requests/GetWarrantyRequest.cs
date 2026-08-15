using System;
using System.Collections.Generic;

namespace Catalog.Application.Warranties;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`). Dodatkowo `SearchProductRequest` pełni
// rolę filtra celu w operacjach masowych (`BatchCommand<TCommand, TFilter>`), więc jego kształt
// jest widoczny w nazwie wygenerowanego typu po stronie klienta.

/// <summary>Pobranie gwarancji po identyfikatorach.</summary>
public sealed class GetWarrantyRequest
{
    public List<Guid>? Uuids { get; set; }
}
