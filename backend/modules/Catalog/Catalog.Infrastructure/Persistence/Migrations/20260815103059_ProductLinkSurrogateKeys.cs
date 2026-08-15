using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductLinkSurrogateKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "pk_product_warranty",
                schema: "catalog",
                table: "product_warranty");

            migrationBuilder.DropPrimaryKey(
                name: "pk_product_multimedia",
                schema: "catalog",
                table: "product_multimedia");

            migrationBuilder.DropPrimaryKey(
                name: "pk_product_category",
                schema: "catalog",
                table: "product_category");

            migrationBuilder.AddColumn<Guid>(
                name: "uuid",
                schema: "catalog",
                table: "product_warranty",
                type: "uuid",
                nullable: false,
                // RĘCZNA POPRAWKA wygenerowanego kodu. EF domyślnie wstawia tu
                // `defaultValue: Guid.Empty`, co nadałoby WSZYSTKIM istniejącym wierszom ten sam
                // identyfikator i wywróciło dodanie klucza głównego dwie instrukcje niżej.
                // `gen_random_uuid()` (w rdzeniu Postgresa od 13) daje każdemu wierszowi własną
                // wartość. To UUID v4, a nie v7 jak reszta identyfikatorów w systemie — dla
                // jednorazowego uzupełnienia danych zastanych to bez znaczenia, nowe wiersze
                // dostają v7 z `Entity.NewUuid()`.
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "uuid",
                schema: "catalog",
                table: "product_multimedia",
                type: "uuid",
                nullable: false,
                // RĘCZNA POPRAWKA wygenerowanego kodu. EF domyślnie wstawia tu
                // `defaultValue: Guid.Empty`, co nadałoby WSZYSTKIM istniejącym wierszom ten sam
                // identyfikator i wywróciło dodanie klucza głównego dwie instrukcje niżej.
                // `gen_random_uuid()` (w rdzeniu Postgresa od 13) daje każdemu wierszowi własną
                // wartość. To UUID v4, a nie v7 jak reszta identyfikatorów w systemie — dla
                // jednorazowego uzupełnienia danych zastanych to bez znaczenia, nowe wiersze
                // dostają v7 z `Entity.NewUuid()`.
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "uuid",
                schema: "catalog",
                table: "product_category",
                type: "uuid",
                nullable: false,
                // RĘCZNA POPRAWKA wygenerowanego kodu. EF domyślnie wstawia tu
                // `defaultValue: Guid.Empty`, co nadałoby WSZYSTKIM istniejącym wierszom ten sam
                // identyfikator i wywróciło dodanie klucza głównego dwie instrukcje niżej.
                // `gen_random_uuid()` (w rdzeniu Postgresa od 13) daje każdemu wierszowi własną
                // wartość. To UUID v4, a nie v7 jak reszta identyfikatorów w systemie — dla
                // jednorazowego uzupełnienia danych zastanych to bez znaczenia, nowe wiersze
                // dostają v7 z `Entity.NewUuid()`.
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddPrimaryKey(
                name: "pk_product_warranty",
                schema: "catalog",
                table: "product_warranty",
                column: "uuid");

            migrationBuilder.AddPrimaryKey(
                name: "pk_product_multimedia",
                schema: "catalog",
                table: "product_multimedia",
                column: "uuid");

            migrationBuilder.AddPrimaryKey(
                name: "pk_product_category",
                schema: "catalog",
                table: "product_category",
                column: "uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_warranty_product_uuid_warranty_uuid",
                schema: "catalog",
                table: "product_warranty",
                columns: new[] { "product_uuid", "warranty_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_multimedia_product_uuid_multimedia_uuid",
                schema: "catalog",
                table: "product_multimedia",
                columns: new[] { "product_uuid", "multimedia_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_category_product_uuid_category_uuid",
                schema: "catalog",
                table: "product_category",
                columns: new[] { "product_uuid", "category_uuid" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "pk_product_warranty",
                schema: "catalog",
                table: "product_warranty");

            migrationBuilder.DropIndex(
                name: "ix_product_warranty_product_uuid_warranty_uuid",
                schema: "catalog",
                table: "product_warranty");

            migrationBuilder.DropPrimaryKey(
                name: "pk_product_multimedia",
                schema: "catalog",
                table: "product_multimedia");

            migrationBuilder.DropIndex(
                name: "ix_product_multimedia_product_uuid_multimedia_uuid",
                schema: "catalog",
                table: "product_multimedia");

            migrationBuilder.DropPrimaryKey(
                name: "pk_product_category",
                schema: "catalog",
                table: "product_category");

            migrationBuilder.DropIndex(
                name: "ix_product_category_product_uuid_category_uuid",
                schema: "catalog",
                table: "product_category");

            migrationBuilder.DropColumn(
                name: "uuid",
                schema: "catalog",
                table: "product_warranty");

            migrationBuilder.DropColumn(
                name: "uuid",
                schema: "catalog",
                table: "product_multimedia");

            migrationBuilder.DropColumn(
                name: "uuid",
                schema: "catalog",
                table: "product_category");

            migrationBuilder.AddPrimaryKey(
                name: "pk_product_warranty",
                schema: "catalog",
                table: "product_warranty",
                columns: new[] { "product_uuid", "warranty_uuid" });

            migrationBuilder.AddPrimaryKey(
                name: "pk_product_multimedia",
                schema: "catalog",
                table: "product_multimedia",
                columns: new[] { "product_uuid", "multimedia_uuid" });

            migrationBuilder.AddPrimaryKey(
                name: "pk_product_category",
                schema: "catalog",
                table: "product_category",
                columns: new[] { "product_uuid", "category_uuid" });
        }
    }
}
