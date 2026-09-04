using Catalog.Domain.Multimedia;
using Erp.BuildingBlocks.Domain;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Reguła usuwania zasobu multimedialnego. Testowana, bo jest to jedyne miejsce, w którym
/// system mógłby cicho skasować dane użytkownika — a projekt świadomie odrzucił wariant
/// „brak referencji = śmieć do zamiecenia" (<c>docs/guides/backend/media-storage.md</c> §4c).
/// </summary>
public class MultimediaOwnershipTests
{
    private static MultimediaAsset Uploaded(MultimediaOwnership ownership)
        => MultimediaAsset.CreateUploaded(
            Guid.Parse("eeeeeeee-0000-0000-0000-000000000001"),
            Guid.Parse("eeeeeeee-0000-0000-0000-000000000002"),
            "zdjecie.jpg",
            "image/jpeg",
            1024,
            sortOrder: 0,
            createdAt: DateTimeOffset.UnixEpoch,
            ownership: ownership);

    [Fact]
    public void Plik_wgrany_przez_galerie_jest_pozycja_biblioteki()
    {
        // Domyślna własność przesądza o tym, czy cokolwiek w systemie kasuje pliki samo z siebie.
        // Paczka zdjęć z modalu trafia do wielu produktów naraz, więc `Owned` byłoby tu kłamstwem.
        var asset = MultimediaAsset.CreateUploaded(
            Guid.NewGuid(), Guid.NewGuid(), "a.jpg", "image/jpeg", 10, 0, DateTimeOffset.UnixEpoch);

        asset.Ownership.ShouldBe(MultimediaOwnership.Library);
    }

    [Fact]
    public void Zasob_bez_referencji_wolno_usunac()
    {
        Should.NotThrow(() => Uploaded(MultimediaOwnership.Library).EnsureCanRemove(0));
    }

    [Fact]
    public void Zasob_biblioteczny_uzywany_przez_produkty_odmawia_usuniecia()
    {
        var exception = Should.Throw<DomainException>(
            () => Uploaded(MultimediaOwnership.Library).EnsureCanRemove(3));

        exception.ErrorCode.ShouldBe("multimedia_still_referenced");
    }

    /// <summary>
    /// Własność <c>Owned</c> daje inny kod błędu, bo daje inną radę: takiego pliku użytkownik
    /// nie odpina — ten znika razem z agregatem, który go trzyma. Komunikat „odepnij najpierw"
    /// prowadziłby donikąd.
    /// </summary>
    [Fact]
    public void Zasob_nalezacy_do_agregatu_odmawia_usuniecia_z_innym_powodem()
    {
        var exception = Should.Throw<DomainException>(
            () => Uploaded(MultimediaOwnership.Owned).EnsureCanRemove(1));

        exception.ErrorCode.ShouldBe("multimedia_owned_by_aggregate");
    }
}
