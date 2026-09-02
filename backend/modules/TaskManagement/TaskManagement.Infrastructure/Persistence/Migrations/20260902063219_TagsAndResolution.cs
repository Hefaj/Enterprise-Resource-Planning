using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TagsAndResolution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "resolution_uuid",
                schema: "taskmgmt",
                table: "issue",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "issue_tag",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_tag", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_tag_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "resolution",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    name_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    order_no = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_resolution", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "tag",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    color = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tag", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_issue_resolution_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "resolution_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_tag_issue_uuid_tag_uuid",
                schema: "taskmgmt",
                table: "issue_tag",
                columns: new[] { "issue_uuid", "tag_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_issue_tag_tag_uuid",
                schema: "taskmgmt",
                table: "issue_tag",
                column: "tag_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_resolution_project_uuid_name",
                schema: "taskmgmt",
                table: "resolution",
                columns: new[] { "project_uuid", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tag_project_uuid_name",
                schema: "taskmgmt",
                table: "tag",
                columns: new[] { "project_uuid", "name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_issue_resolution_resolution_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "resolution_uuid",
                principalSchema: "taskmgmt",
                principalTable: "resolution",
                principalColumn: "uuid",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_issue_resolution_resolution_uuid",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropTable(
                name: "issue_tag",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "resolution",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "tag",
                schema: "taskmgmt");

            migrationBuilder.DropIndex(
                name: "ix_issue_resolution_uuid",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "resolution_uuid",
                schema: "taskmgmt",
                table: "issue");
        }
    }
}
