using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedIssueViewsAndWorkLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "saved_issue_view",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    filter_json = table.Column<string>(type: "jsonb", nullable: false),
                    columns_json = table.Column<string>(type: "jsonb", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saved_issue_view", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "work_log",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    author_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    minutes = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    logged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_work_log", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_saved_issue_view_owner_uuid",
                schema: "taskmgmt",
                table: "saved_issue_view",
                column: "owner_uuid",
                unique: true,
                filter: "is_default = true");

            migrationBuilder.CreateIndex(
                name: "ix_saved_issue_view_owner_uuid_name",
                schema: "taskmgmt",
                table: "saved_issue_view",
                columns: new[] { "owner_uuid", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_work_log_issue_uuid_logged_at",
                schema: "taskmgmt",
                table: "work_log",
                columns: new[] { "issue_uuid", "logged_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "saved_issue_view",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "work_log",
                schema: "taskmgmt");
        }
    }
}
