using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveGraphQueryTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "graph_edge_row",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "subtree_row",
                schema: "taskmgmt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "graph_edge_row",
                schema: "taskmgmt",
                columns: table => new
                {
                    reached_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    seed_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "subtree_row",
                schema: "taskmgmt",
                columns: table => new
                {
                    level = table.Column<int>(type: "integer", nullable: false),
                    root_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                });
        }
    }
}
