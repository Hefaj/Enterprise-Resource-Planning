using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Notification.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_notification",
                schema: "notification",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    actor_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    kind = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    severity = table.Column<int>(type: "integer", nullable: false),
                    subject_signature = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    subject_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    title_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    params_json = table.Column<string>(type: "jsonb", nullable: false),
                    group_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    occurrence_count = table.Column<int>(type: "integer", nullable: false),
                    last_occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    link = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expire_on = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_notification", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_user_notification_user_id",
                schema: "notification",
                table: "user_notification",
                column: "user_id",
                filter: "read_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_user_notification_user_id_created_at",
                schema: "notification",
                table: "user_notification",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_user_notification_user_id_group_key",
                schema: "notification",
                table: "user_notification",
                columns: new[] { "user_id", "group_key" },
                unique: true,
                filter: "group_key IS NOT NULL AND read_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_user_notification_user_id_kind_subject_uuid_correlation_id",
                schema: "notification",
                table: "user_notification",
                columns: new[] { "user_id", "kind", "subject_uuid", "correlation_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_notification",
                schema: "notification");
        }
    }
}
