using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Automations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "automation_rule_uuid",
                schema: "taskmgmt",
                table: "issue_activity",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "automation_rule",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    trigger_kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    condition_json = table.Column<string>(type: "text", nullable: true),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_rule", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "automation_run",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    rule_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    outcome = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    error_message = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_run", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "automation_action",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    rule_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    config_json = table.Column<string>(type: "text", nullable: false),
                    order_no = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_automation_action", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_automation_action_automation_rule_rule_uuid",
                        column: x => x.rule_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "automation_rule",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_automation_action_rule_uuid",
                schema: "taskmgmt",
                table: "automation_action",
                column: "rule_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_automation_rule_project_uuid_trigger_kind_is_enabled",
                schema: "taskmgmt",
                table: "automation_rule",
                columns: new[] { "project_uuid", "trigger_kind", "is_enabled" });

            migrationBuilder.CreateIndex(
                name: "ix_automation_run_rule_uuid_occurred_at",
                schema: "taskmgmt",
                table: "automation_run",
                columns: new[] { "rule_uuid", "occurred_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "automation_action",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "automation_run",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "automation_rule",
                schema: "taskmgmt");

            migrationBuilder.DropColumn(
                name: "automation_rule_uuid",
                schema: "taskmgmt",
                table: "issue_activity");
        }
    }
}
