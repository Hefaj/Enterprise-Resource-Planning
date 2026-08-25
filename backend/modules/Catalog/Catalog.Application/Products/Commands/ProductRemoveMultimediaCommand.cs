using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Odpięcie wskazanych multimediów od produktu — lustrzane odbicie
/// <see cref="ProductAddMultimediaCommand"/>.
///
/// <para><b>To jest odpięcie, a nie skasowanie pliku.</b> Zasób jest osobnym agregatem
/// i pozycją biblioteki mediów; użytkownik, który zdejmuje zdjęcie z produktu, nie prosi
/// o usunięcie go z katalogu. Plik znika stąd wyłącznie wtedy, gdy jego właściciel zadeklarował
/// go jako <c>Owned</c> — wtedy zabiera go kaskada, w tej samej transakcji
/// (<c>docs/backend/media-storage.md</c> §4c). Jawne usunięcie zasobu z biblioteki ma własną
/// komendę: <c>MultimediaRemoveCommand</c>.</para>
///
/// <para>Lista wewnątrz komendy z tego samego powodu, co przy dopinaniu: w trybie
/// „szablon + filtr" jedno zadanie zdejmuje tę samą paczkę zdjęć ze wszystkich produktów
/// pasujących do filtra.</para>
/// </summary>
public sealed class ProductRemoveMultimediaCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>
    /// Zasoby do odpięcia. Zasób, którego przy produkcie nie ma, jest pomijany po cichu —
    /// operacja kończy się stanem, o który wołającemu chodziło.
    /// </summary>
    public List<Guid> MultimediaUuids { get; set; } = [];
}
