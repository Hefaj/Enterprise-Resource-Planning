using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Products;

/// <summary>
/// Podmiana CAŁEJ galerii produktu; pusta lista czyści ją do zera
/// (<c>docs/guides/backend/endpoint-naming.md</c> §2 — <c>Set</c> z pustą kolekcją zastępuje
/// nieistniejące <c>Clear</c>).
///
/// <para><b>Po co, skoro jest <see cref="ProductRemoveMultimediaCommand"/>.</b> „Zdejmij
/// wszystkie multimedia" przy zaznaczeniu opisanym filtrem nie da się wyrazić listą: front nie
/// wie, co wisi przy produktach, których nie wczytał, a wyliczanie tego po stronie klienta
/// oznaczałoby pobranie galerii wszystkich celów tylko po to, żeby odesłać ją z powrotem.
/// Pusta podmiana adresuje stan docelowy, nie zawartość — i jest idempotentna.</para>
///
/// <para><b>Wąskość jest tu warunkiem bezpieczeństwa.</b> Komenda dotyka jednego plastra stanu
/// (galerii) i niczego poza nim — pole nieprzysłane przez klienta przyjmuje <c>default</c>,
/// więc szerokie <c>Set</c> kasowałoby przy okazji wszystko inne, i to przez cały filtr
/// (<c>endpoint-naming.md</c> §3).</para>
/// </summary>
public sealed class ProductSetMultimediaCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Docelowy komplet zasobów produktu. Pusta lista = wyczyszczenie galerii.</summary>
    public List<Guid> MultimediaUuids { get; set; } = [];
}
