using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Notification.Infrastructure.Persistence.Migrations;

public partial class UserNotifications : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "user_notification",
            schema: "notification",
            columns: table => new
            {
                uuid = table.Column<Guid>(type: "uuid", nullable: false),
                user_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                kind = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                subject_signature = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                subject_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                subject_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                title_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                @params = table.Column<string>(type: "jsonb", nullable: false),
                group_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                link = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                severity = table.Column<int>(type: "integer", nullable: false),
                occurrence_count = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                last_occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                expire_on = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_user_notification", x => x.uuid));
        migrationBuilder.CreateIndex(
            name: "ix_user_notification_user_uuid_created_at",
            schema: "notification",
            table: "user_notification",
            columns: new[] { "user_uuid", "created_at" },
            descending: new[] { false, true });
        migrationBuilder.CreateIndex(
            name: "ix_user_notification_unread",
            schema: "notification",
            table: "user_notification",
            column: "user_uuid",
            filter: "read_at IS NULL");
        migrationBuilder.CreateIndex(
            name: "ix_user_notification_active_group",
            schema: "notification",
            table: "user_notification",
            columns: new[] { "user_uuid", "group_key" },
            unique: true,
            filter: "group_key IS NOT NULL AND read_at IS NULL");
        migrationBuilder.CreateIndex(
            name: "ix_user_notification_ungrouped_dedup",
            schema: "notification",
            table: "user_notification",
            columns: new[] { "user_uuid", "kind", "subject_uuid", "correlation_id" },
            unique: true,
            filter: "group_key IS NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("user_notification", "notification");
}
