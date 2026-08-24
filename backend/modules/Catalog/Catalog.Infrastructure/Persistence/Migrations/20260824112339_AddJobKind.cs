using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_job_status_created_at",
                schema: "catalog",
                table: "job");

            migrationBuilder.AddColumn<int>(
                name: "kind",
                schema: "catalog",
                table: "job",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "ix_job_kind_status_created_at",
                schema: "catalog",
                table: "job",
                columns: new[] { "kind", "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_job_kind_status_created_at",
                schema: "catalog",
                table: "job");

            migrationBuilder.DropColumn(
                name: "kind",
                schema: "catalog",
                table: "job");

            migrationBuilder.CreateIndex(
                name: "ix_job_status_created_at",
                schema: "catalog",
                table: "job",
                columns: new[] { "status", "created_at" });
        }
    }
}
