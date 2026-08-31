using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IssueTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "issue_type_scheme_uuid",
                schema: "taskmgmt",
                table: "project",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "type_uuid",
                schema: "taskmgmt",
                table: "issue",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "name",
                schema: "taskmgmt",
                table: "field_definition",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "issue_type_scheme",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_type_scheme", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "issue_type",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    name_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    icon = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    category = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    order_no = table.Column<int>(type: "integer", nullable: false),
                    workflow_scheme_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    field_scheme_uuid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_type", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_type_issue_type_scheme_scheme_uuid",
                        column: x => x.scheme_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue_type_scheme",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_project_issue_type_scheme_uuid",
                schema: "taskmgmt",
                table: "project",
                column: "issue_type_scheme_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_type_uuid",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "type_uuid" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_type_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "type_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_type_scheme_uuid_code",
                schema: "taskmgmt",
                table: "issue_type",
                columns: new[] { "scheme_uuid", "code" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_issue_issue_type_type_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "type_uuid",
                principalSchema: "taskmgmt",
                principalTable: "issue_type",
                principalColumn: "uuid",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_project_issue_type_scheme_issue_type_scheme_uuid",
                schema: "taskmgmt",
                table: "project",
                column: "issue_type_scheme_uuid",
                principalSchema: "taskmgmt",
                principalTable: "issue_type_scheme",
                principalColumn: "uuid",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_issue_issue_type_type_uuid",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropForeignKey(
                name: "fk_project_issue_type_scheme_issue_type_scheme_uuid",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropTable(
                name: "issue_type",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "issue_type_scheme",
                schema: "taskmgmt");

            migrationBuilder.DropIndex(
                name: "ix_project_issue_type_scheme_uuid",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_type_uuid",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_type_uuid",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "issue_type_scheme_uuid",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "type_uuid",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "name",
                schema: "taskmgmt",
                table: "field_definition");
        }
    }
}
