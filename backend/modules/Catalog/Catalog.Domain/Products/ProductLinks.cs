using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Products;

/// <summary>
/// Przypisanie produktu do kategorii. Byt wewnętrzny agregatu (owned), bez własnej tożsamości
/// biznesowej — nikt nie ładuje ani nie edytuje „przypisania” samodzielnie.
/// </summary>
public sealed class ProductCategoryLink
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProductCategoryLink()
    {
    }

    internal ProductCategoryLink(Guid productUuid, Guid categoryUuid)
    {
        ProductUuid = productUuid;
        CategoryUuid = categoryUuid;
    }

    public Guid ProductUuid { get; private set; }

    public Guid CategoryUuid { get; private set; }
}

/// <summary>Powiązanie produktu z zasobem multimedialnym.</summary>
public sealed class ProductMultimediaLink
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProductMultimediaLink()
    {
    }

    internal ProductMultimediaLink(Guid productUuid, Guid multimediaUuid)
    {
        ProductUuid = productUuid;
        MultimediaUuid = multimediaUuid;
    }

    public Guid ProductUuid { get; private set; }

    public Guid MultimediaUuid { get; private set; }
}

/// <summary>
/// Gwarancja przypisana do produktu wraz z <b>faktycznym</b> okresem.
///
/// <see cref="DurationMonths"/> jest tu świadomą kopią, a nie odwołaniem do
/// <c>Warranty.DurationMonths</c>: promocyjnie wydłużony okres należy do produktu, a nie do
/// definicji w katalogu. Gdyby produkt czytał okres z definicji, zmiana katalogu przepisałaby
/// warunki wszystkich produktów wstecz — łącznie z tymi już sprzedanymi.
/// </summary>
public sealed class ProductWarranty
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private ProductWarranty()
    {
    }

    internal ProductWarranty(Guid productUuid, Guid warrantyUuid, int durationMonths)
    {
        if (durationMonths <= 0)
        {
            throw new DomainException(
                "product_warranty_duration_invalid",
                "Okres gwarancji produktu musi być dodatni.");
        }

        ProductUuid = productUuid;
        WarrantyUuid = warrantyUuid;
        DurationMonths = durationMonths;
    }

    public Guid ProductUuid { get; private set; }

    /// <summary>Definicja gwarancji z katalogu.</summary>
    public Guid WarrantyUuid { get; private set; }

    /// <summary>Okres obowiązujący dla tego produktu.</summary>
    public int DurationMonths { get; private set; }
}
