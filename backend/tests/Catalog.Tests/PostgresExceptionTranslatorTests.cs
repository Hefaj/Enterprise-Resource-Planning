using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Shouldly;
using Xunit;

namespace Catalog.Tests;

/// <summary>
/// Translator zamyka pętlę reguły duplikatu: pre-check wsadowy może ją przegapić (między
/// utworzeniem zadania a wykonaniem chunka mija dowolnie dużo czasu), więc ostatnią linią
/// obrony jest unikalny indeks. Bez tłumaczenia jego naruszenie trafia do raportu jako
/// `persistence_error` i jest ponawiane — mimo że duplikat jest trwały.
/// </summary>
public class PostgresExceptionTranslatorTests
{
    private static readonly Dictionary<string, string> Map = new(StringComparer.Ordinal)
    {
        ["ix_product_duplicate_key"] = "product_duplicate",
        ["ix_product_sku"] = "product_sku_duplicate",
    };

    private static DbUpdateException UniqueViolation(string constraintName)
        => Wrap(new PostgresException(
            messageText: "duplicate key value violates unique constraint",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: PostgresErrorCodes.UniqueViolation,
            constraintName: constraintName));

    private static DbUpdateException Wrap(Exception inner)
        => new("Zapis nie powiódł się.", inner);

    [Fact]
    public void Naruszenie_znanego_indeksu_dostaje_kod_domenowy()
    {
        new PostgresExceptionTranslator(Map)
            .TryTranslate(UniqueViolation("ix_product_duplicate_key"), out var translated)
            .ShouldBeTrue();

        translated!.ErrorCode.ShouldBe("product_duplicate");
    }

    [Fact]
    public void Kazdy_zmapowany_indeks_ma_wlasny_kod()
    {
        new PostgresExceptionTranslator(Map)
            .TryTranslate(UniqueViolation("ix_product_sku"), out var translated)
            .ShouldBeTrue();

        translated!.ErrorCode.ShouldBe("product_sku_duplicate");
    }

    /// <summary>
    /// Zgadywanie kodu dla nieznanego ograniczenia dałoby raport, który wygląda sensownie,
    /// a nie jest — lepiej zostawić `persistence_error`.
    /// </summary>
    [Fact]
    public void Nieznane_ograniczenie_zostaje_nieprzetlumaczone()
    {
        new PostgresExceptionTranslator(Map)
            .TryTranslate(UniqueViolation("ix_czegos_innego"), out var translated)
            .ShouldBeFalse();

        translated.ShouldBeNull();
    }

    /// <summary>Inne błędy bazy to nadal awarie techniczne, nie naruszenia reguł.</summary>
    [Fact]
    public void Blad_inny_niz_naruszenie_unikalnosci_nie_jest_tlumaczony()
    {
        var foreignKeyViolation = Wrap(new PostgresException(
            messageText: "insert or update violates foreign key constraint",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: PostgresErrorCodes.ForeignKeyViolation,
            constraintName: "ix_product_duplicate_key"));

        new PostgresExceptionTranslator(Map)
            .TryTranslate(foreignKeyViolation, out _)
            .ShouldBeFalse();
    }

    [Fact]
    public void Wyjatek_bez_przyczyny_z_Postgresa_nie_jest_tlumaczony()
        => new PostgresExceptionTranslator(Map)
            .TryTranslate(new DbUpdateException("Coś poszło nie tak."), out _)
            .ShouldBeFalse();
}
