using Shouldly;
using TaskManagement.Domain.Projects;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Zmiana prefiksu (PRJ-003) i archiwizacja projektu (PRJ-004).</summary>
public class ProjectArchivalAndCodeTests
{
    private static Project NewProject()
        => Project.CreateWithUuid(
            Guid.CreateVersion7(), "DEV", "Rozwój", ProjectKind.Delivery, Guid.CreateVersion7(), Guid.CreateVersion7(), true);

    [Fact]
    public void Projekt_domyslnie_nie_jest_zarchiwizowany()
    {
        var project = NewProject();

        project.IsArchived.ShouldBeFalse();
    }

    [Fact]
    public void Archiwizacja_ustawia_flage()
    {
        var project = NewProject();

        project.Archive();

        project.IsArchived.ShouldBeTrue();
    }

    [Fact]
    public void Przywrocenie_czysci_flage()
    {
        var project = NewProject();
        project.Archive();

        project.Unarchive();

        project.IsArchived.ShouldBeFalse();
    }

    [Fact]
    public void Zarchiwizowany_projekt_odrzuca_nowe_zgloszenie()
    {
        var project = NewProject();
        project.Archive();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(project.EnsureNotArchived);
    }

    [Fact]
    public void Aktywny_projekt_pozwala_zalozyc_zgloszenie()
    {
        var project = NewProject();

        Should.NotThrow(project.EnsureNotArchived);
    }

    [Fact]
    public void Zmiana_prefiksu_normalizuje_do_wielkich_liter()
    {
        var project = NewProject();

        project.SetCode("mkt");

        project.Code.ShouldBe("MKT");
    }

    [Fact]
    public void Prefiks_z_myslnikiem_jest_odrzucany()
    {
        var project = NewProject();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(() => project.SetCode("MK-T"));
    }

    [Fact]
    public void Projekt_domyslnie_nie_ma_widoku_domyslnego()
        => NewProject().DefaultSavedViewUuid.ShouldBeNull();

    [Fact]
    public void Ustawienie_widoku_domyslnego_zapisuje_uuid()
    {
        var project = NewProject();
        var viewUuid = Guid.CreateVersion7();

        project.SetDefaultSavedView(viewUuid);

        project.DefaultSavedViewUuid.ShouldBe(viewUuid);
    }

    [Fact]
    public void Guid_Empty_jako_widok_domyslny_jest_traktowany_jak_brak()
    {
        var project = NewProject();

        project.SetDefaultSavedView(Guid.Empty);

        project.DefaultSavedViewUuid.ShouldBeNull();
    }

    [Fact]
    public void Zdjecie_widoku_domyslnego_zeruje_pole()
    {
        var project = NewProject();
        project.SetDefaultSavedView(Guid.CreateVersion7());

        project.SetDefaultSavedView(null);

        project.DefaultSavedViewUuid.ShouldBeNull();
    }
}
