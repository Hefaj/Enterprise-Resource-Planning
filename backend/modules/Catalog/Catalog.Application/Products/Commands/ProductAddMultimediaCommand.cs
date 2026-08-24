using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Dopięcie multimediów do produktu — bez ruszania tych, które już przy nim wiszą.
///
/// <para><b>Dlaczego lista, a nie jeden plik na komendę.</b> Kontrakt wsadowy wiąże jedną komendę
/// z jednym agregatem docelowym (<c>BatchCommand</c>), więc plik na komendę oznaczałby tyle
/// celów, ile wynosi iloczyn plików i produktów, a przy trybie „szablon + filtr" — jeden plik
/// na całą operację. Lista wewnątrz komendy pozwala wysłać „te pięć zdjęć do wszystkich produktów
/// pasujących do filtra" jako jedno zadanie.</para>
///
/// <para>To <c>Add</c>, a nie <c>Set</c>: <c>ProductSetMultimediaCommand</c> podmieniałby CAŁĄ
/// galerię, czyli dodanie szóstego zdjęcia kasowałoby pięć poprzednich
/// (<c>docs/backend/endpoint-naming.md</c> §3).</para>
/// </summary>
public sealed class ProductAddMultimediaCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Zasoby do dopięcia; muszą już istnieć w katalogu.</summary>
    public List<Guid> MultimediaUuids { get; set; } = [];
}
