using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReportRunRename : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "export_run",
                schema: "catalog");

            migrationBuilder.CreateTable(
                name: "report_run",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    report_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    format = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    parameters_json = table.Column<string>(type: "jsonb", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    job_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    record_count = table.Column<int>(type: "integer", nullable: false),
                    error_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    heartbeat_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expire_on = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_report_run", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_report_run_job_uuid",
                schema: "catalog",
                table: "report_run",
                column: "job_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_report_run_report_key",
                schema: "catalog",
                table: "report_run",
                column: "report_key");

            migrationBuilder.CreateIndex(
                name: "ix_report_run_status_created_at",
                schema: "catalog",
                table: "report_run",
                columns: new[] { "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "report_run",
                schema: "catalog");

            migrationBuilder.CreateTable(
                name: "export_run",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    error_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    expire_on = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    format = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    heartbeat_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    job_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    parameters_json = table.Column<string>(type: "jsonb", nullable: true),
                    record_count = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_export_run", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_export_run_job_uuid",
                schema: "catalog",
                table: "export_run",
                column: "job_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_export_run_status_created_at",
                schema: "catalog",
                table: "export_run",
                columns: new[] { "status", "created_at" });
        }
    }
}
