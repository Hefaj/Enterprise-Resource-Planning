using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IssueAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "issue_attachment",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    artifact_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    mime_type = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    uploaded_by_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_attachment", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_attachment_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_issue_attachment_artifact_uuid",
                schema: "taskmgmt",
                table: "issue_attachment",
                column: "artifact_uuid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_issue_attachment_issue_uuid",
                schema: "taskmgmt",
                table: "issue_attachment",
                column: "issue_uuid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "issue_attachment",
                schema: "taskmgmt");
        }
    }
}
