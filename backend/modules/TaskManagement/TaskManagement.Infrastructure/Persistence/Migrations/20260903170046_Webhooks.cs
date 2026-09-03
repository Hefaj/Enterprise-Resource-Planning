using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Webhooks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "webhook",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    secret = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    consecutive_failure_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    event_kinds = table.Column<List<string>>(type: "text[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_webhook", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "webhook_delivery",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    webhook_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    event_kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_error = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_webhook_delivery", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_webhook_project_uuid_is_enabled",
                schema: "taskmgmt",
                table: "webhook",
                columns: new[] { "project_uuid", "is_enabled" });

            migrationBuilder.CreateIndex(
                name: "ix_webhook_delivery_status_next_attempt_at",
                schema: "taskmgmt",
                table: "webhook_delivery",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "ix_webhook_delivery_webhook_uuid_created_at",
                schema: "taskmgmt",
                table: "webhook_delivery",
                columns: new[] { "webhook_uuid", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "webhook",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "webhook_delivery",
                schema: "taskmgmt");
        }
    }
}
