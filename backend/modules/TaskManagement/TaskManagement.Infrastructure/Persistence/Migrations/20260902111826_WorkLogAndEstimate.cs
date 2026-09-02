using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WorkLogAndEstimate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "estimate_minutes",
                schema: "taskmgmt",
                table: "issue",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "delivery_hours_row",
                schema: "taskmgmt",
                columns: table => new
                {
                    execution_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    execution_issue_key = table.Column<string>(type: "text", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_code = table.Column<string>(type: "text", nullable: false),
                    project_name = table.Column<string>(type: "text", nullable: false),
                    minutes = table.Column<int>(type: "integer", nullable: false),
                    shared_with_other_requests_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "issue_work_log",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    user_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    work_type_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    logged_on = table.Column<DateOnly>(type: "date", nullable: false),
                    minutes = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_work_log", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "work_type",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_work_type", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_issue_work_log_issue_uuid",
                schema: "taskmgmt",
                table: "issue_work_log",
                column: "issue_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_work_log_issue_uuid_logged_on",
                schema: "taskmgmt",
                table: "issue_work_log",
                columns: new[] { "issue_uuid", "logged_on" });

            migrationBuilder.CreateIndex(
                name: "ix_work_type_project_uuid_name",
                schema: "taskmgmt",
                table: "work_type",
                columns: new[] { "project_uuid", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "delivery_hours_row",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "issue_work_log",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "work_type",
                schema: "taskmgmt");

            migrationBuilder.DropColumn(
                name: "estimate_minutes",
                schema: "taskmgmt",
                table: "issue");
        }
    }
}
