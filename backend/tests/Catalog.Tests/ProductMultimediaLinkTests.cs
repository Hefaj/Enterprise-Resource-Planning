using Catalog.Domain.Products;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Odpinanie multimediów od produktu. Metody zwracają zasoby faktycznie odpięte, bo na tej
/// liście stoi kaskada usuwająca pliki <c>Owned</c> — zwrócenie za dużo znaczy tu skasowanie
/// cudzego pliku, a za mało: sierotę w magazynie.
/// </summary>
public class ProductMultimediaLinkTests
{
    private static readonly Guid First = Guid.Parse("dddddddd-0000-0000-0000-000000000001");
    private static readonly Guid Second = Guid.Parse("dddddddd-0000-0000-0000-000000000002");
    private static readonly Guid Third = Guid.Parse("dddddddd-0000-0000-0000-000000000003");

    private static Product WithGallery(params Guid[] multimedia)
    {
        var product = Product.Create("Produkt", 10m);
        product.AddMultimedia(multimedia);

        return product;
    }

    [Fact]
    public void Odpiecie_zdejmuje_wskazane_i_zostawia_reszte()
    {
        var product = WithGallery(First, Second, Third);

        var detached = product.RemoveMultimedia([First, Third]);

        detached.ShouldBe([First, Third], ignoreOrder: true);
        product.MultimediaUuids.ShouldBe([Second]);
    }

    /// <summary>
    /// Zasób, którego przy produkcie nie ma, jest pomijany po cichu — tak samo jak powtórzenie
    /// przy dopinaniu. Inaczej jedno odpięcie zrobione wcześniej ręcznie wywracałoby całą paczkę
    /// operacji masowej.
    /// </summary>
    [Fact]
    public void Odpiecie_czegos_czego_nie_ma_nie_jest_bledem_i_nie_wchodzi_do_kaskady()
    {
        var product = WithGallery(First);

        var detached = product.RemoveMultimedia([Second]);

        detached.ShouldBeEmpty();
        product.MultimediaUuids.ShouldBe([First]);
    }

    [Fact]
    public void Podmiana_na_pusta_liste_czysci_galerie_i_zwraca_wszystko()
    {
        var product = WithGallery(First, Second);

        var detached = product.SetMultimedia([]);

        detached.ShouldBe([First, Second], ignoreOrder: true);
        product.MultimediaUuids.ShouldBeEmpty();
    }

    /// <summary>
    /// Podmiana zwraca WYŁĄCZNIE to, co wypadło z galerii. Zasób obecny po obu stronach zostaje
    /// przy produkcie, więc nie ma prawa trafić do kaskady.
    /// </summary>
    [Fact]
    public void Podmiana_zwraca_tylko_te_zasoby_ktore_wypadly()
    {
        var product = WithGallery(First, Second);

        var detached = product.SetMultimedia([Second, Third]);

        detached.ShouldBe([First]);
        product.MultimediaUuids.ShouldBe([Second, Third], ignoreOrder: true);
    }
}
