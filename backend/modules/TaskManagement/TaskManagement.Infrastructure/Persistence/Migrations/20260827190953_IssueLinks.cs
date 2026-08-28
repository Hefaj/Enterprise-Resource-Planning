using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IssueLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "graph_edge_row",
                schema: "taskmgmt",
                columns: table => new
                {
                    seed_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    reached_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "issue_link",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    source_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    target_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_link", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_link_issue_source_uuid",
                        column: x => x.source_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_issue_link_issue_target_uuid",
                        column: x => x.target_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "subtree_row",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    level = table.Column<int>(type: "integer", nullable: false),
                    root_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateIndex(
                name: "ix_issue_link_source_uuid_target_uuid_type",
                schema: "taskmgmt",
                table: "issue_link",
                columns: new[] { "source_uuid", "target_uuid", "type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_issue_link_target_uuid",
                schema: "taskmgmt",
                table: "issue_link",
                column: "target_uuid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "graph_edge_row",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "issue_link",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "subtree_row",
                schema: "taskmgmt");
        }
    }
}
