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
}
