using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Tags;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Reguły tagu jako bytu (TAG-001) i dopinania go do zgłoszenia.</summary>
public class TagTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public void Zakladanie_tagu_z_pusta_nazwa_jest_odrzucane()
        => Should.Throw<DomainException>(() => Tag.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, "  ", null))
            .ErrorCode.ShouldBe("taskmgmt.tag_name_empty");

    [Fact]
    public void Tag_bez_projektu_jest_globalny()
        => Tag.CreateWithUuid(Guid.CreateVersion7(), null, "backend", null).ProjectUuid.ShouldBeNull();

    [Fact]
    public void Brak_koloru_dostaje_domyslny()
        => Tag.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, "backend", null).Color.ShouldNotBeNullOrWhiteSpace();
}
