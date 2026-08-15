using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductDuplicateKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "duplicate_key",
                schema: "catalog",
                table: "product",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_duplicate_key",
                schema: "catalog",
                table: "product",
                column: "duplicate_key",
                unique: true,
                filter: "duplicate_key IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_product_duplicate_key",
                schema: "catalog",
                table: "product");

            migrationBuilder.DropColumn(
                name: "duplicate_key",
                schema: "catalog",
                table: "product");
        }
    }
}
