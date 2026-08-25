using System;
using System.Collections.Generic;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Multimedia;

// Typy żądań też należą do zamrożonego kontraktu HTTP — NSwag generuje z nich interfejsy
// wywoływane przez orkiestratory (`searchByFilters`). Dodatkowo `SearchProductRequest` pełni
// rolę filtra celu w operacjach masowych (`BatchCommand<TCommand, TFilter>`), więc jego kształt
// jest widoczny w nazwie wygenerowanego typu po stronie klienta.

/// <summary>
/// Filtry wyszukiwania multimediów.
///
/// <para>Ten sam typ jest filtrem celu operacji masowych na zasobach
/// (<c>BatchCommandOfMultimediaRemoveCommandAndSearchMultimediaRequest</c>), więc każde pole
/// dołożone tutaj jest jednocześnie sposobem wskazania celów „wszystkiemu, co pasuje". Stąd
/// <see cref="OnlyUnreferenced"/>: „skasuj wszystkie osierocone pliki" ma być jednym żądaniem,
/// a nie listą uuidów wyklikaną ręcznie.</para>
/// </summary>
public sealed class SearchMultimediaRequest : PagedRequest
{
    public List<Guid>? Uuids { get; set; }

    /// <summary>Fragment nazwy pliku, bez rozróżniania wielkości liter.</summary>
    public string? FileName { get; set; }

    /// <summary>Rodzaj zasobu (<c>image</c>, <c>video</c>, <c>document</c>…), dokładne dopasowanie.</summary>
    public string? MediaType { get; set; }

    /// <summary>
    /// Tylko zasoby, na które nie wskazuje żaden produkt.
    ///
    /// <para>To jest jedyny filtr, po którym da się dojść do plików nadających się do usunięcia:
    /// zasób z choćby jedną referencją i tak odpadnie w komendzie
    /// (<c>multimedia_still_referenced</c>).</para>
    /// </summary>
    public bool? OnlyUnreferenced { get; set; }

    /// <summary>Tylko zasoby bez wygenerowanych wariantów pochodnych — cele „Generuj miniatury".</summary>
    public bool? OnlyWithoutDerivatives { get; set; }
}
