using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WatchersAndIntake : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_issue_due_at",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.AddColumn<string>(
                name: "derived_delivery_state",
                schema: "taskmgmt",
                table: "issue",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_overdue_notified_at",
                schema: "taskmgmt",
                table: "issue",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "state_category",
                schema: "taskmgmt",
                table: "issue",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "issue_watcher",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    user_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    opted_out_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_watcher", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_watcher_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_issue_due_at",
                schema: "taskmgmt",
                table: "issue",
                column: "due_at",
                filter: "state_category <> 'Done'");

            migrationBuilder.CreateIndex(
                name: "ix_issue_watcher_issue_uuid_user_uuid",
                schema: "taskmgmt",
                table: "issue_watcher",
                columns: new[] { "issue_uuid", "user_uuid" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "issue_watcher",
                schema: "taskmgmt");

            migrationBuilder.DropIndex(
                name: "ix_issue_due_at",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "derived_delivery_state",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "last_overdue_notified_at",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "state_category",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.CreateIndex(
                name: "ix_issue_due_at",
                schema: "taskmgmt",
                table: "issue",
                column: "due_at");
        }
    }
}
