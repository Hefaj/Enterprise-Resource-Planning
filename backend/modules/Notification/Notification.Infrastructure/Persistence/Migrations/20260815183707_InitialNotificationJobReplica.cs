using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Notification.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialNotificationJobReplica : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "notification");

            migrationBuilder.CreateTable(
                name: "job",
                schema: "notification",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    queue_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    tracking_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    command_type = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    command_json = table.Column<string>(type: "jsonb", nullable: true),
                    total_count = table.Column<int>(type: "integer", nullable: false),
                    succeeded_count = table.Column<int>(type: "integer", nullable: false),
                    failed_count = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    is_complete = table.Column<bool>(type: "boolean", nullable: false),
                    errors_summary = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    client_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ui_metadata = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expire_on = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_job_client_id",
                schema: "notification",
                table: "job",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_created_at",
                schema: "notification",
                table: "job",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_job_is_complete",
                schema: "notification",
                table: "job",
                column: "is_complete");

            migrationBuilder.CreateIndex(
                name: "ix_job_queue_id",
                schema: "notification",
                table: "job",
                column: "queue_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_tracking_id",
                schema: "notification",
                table: "job",
                column: "tracking_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_user_id",
                schema: "notification",
                table: "job",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job",
                schema: "notification");
        }
    }
}
