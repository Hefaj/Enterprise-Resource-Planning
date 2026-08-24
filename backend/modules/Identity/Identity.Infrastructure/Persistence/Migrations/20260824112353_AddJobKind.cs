using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_job_status_created_at",
                schema: "identity",
                table: "job");

            migrationBuilder.AddColumn<int>(
                name: "kind",
                schema: "identity",
                table: "job",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "ix_job_kind_status_created_at",
                schema: "identity",
                table: "job",
                columns: new[] { "kind", "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_job_kind_status_created_at",
                schema: "identity",
                table: "job");

            migrationBuilder.DropColumn(
                name: "kind",
                schema: "identity",
                table: "job");

            migrationBuilder.CreateIndex(
                name: "ix_job_status_created_at",
                schema: "identity",
                table: "job",
                columns: new[] { "status", "created_at" });
        }
    }
}
