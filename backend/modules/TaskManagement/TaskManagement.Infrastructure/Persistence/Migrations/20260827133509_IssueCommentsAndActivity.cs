using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IssueCommentsAndActivity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "issue_activity",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<short>(type: "smallint", nullable: false),
                    field_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    old_value = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    new_value = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    actor_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_activity", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_activity_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "issue_comment",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    body = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    original_body = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    author_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    removed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_comment", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_comment_issue_comment_parent_uuid",
                        column: x => x.parent_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue_comment",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_issue_comment_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_issue_activity_issue_uuid_occurred_at",
                schema: "taskmgmt",
                table: "issue_activity",
                columns: new[] { "issue_uuid", "occurred_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_issue_comment_issue_uuid_created_at",
                schema: "taskmgmt",
                table: "issue_comment",
                columns: new[] { "issue_uuid", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_comment_parent_uuid",
                schema: "taskmgmt",
                table: "issue_comment",
                column: "parent_uuid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "issue_activity",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "issue_comment",
                schema: "taskmgmt");
        }
    }
}
