using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CustomFieldsAndSlots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "field_scheme_uuid",
                schema: "taskmgmt",
                table: "project",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "custom_fields",
                schema: "taskmgmt",
                table: "issue",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "date_1",
                schema: "taskmgmt",
                table: "issue",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "date_2",
                schema: "taskmgmt",
                table: "issue",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "date_3",
                schema: "taskmgmt",
                table: "issue",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "date_4",
                schema: "taskmgmt",
                table: "issue",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "num_1",
                schema: "taskmgmt",
                table: "issue",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "num_2",
                schema: "taskmgmt",
                table: "issue",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "num_3",
                schema: "taskmgmt",
                table: "issue",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "num_4",
                schema: "taskmgmt",
                table: "issue",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "text_1",
                schema: "taskmgmt",
                table: "issue",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "text_2",
                schema: "taskmgmt",
                table: "issue",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "text_3",
                schema: "taskmgmt",
                table: "issue",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "text_4",
                schema: "taskmgmt",
                table: "issue",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "user_1",
                schema: "taskmgmt",
                table: "issue",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "user_2",
                schema: "taskmgmt",
                table: "issue",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "field_scheme",
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
                    table.PrimaryKey("pk_field_scheme", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "field_definition",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    data_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    slot = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    order_no = table.Column<int>(type: "integer", nullable: false),
                    is_required = table.Column<bool>(type: "boolean", nullable: false),
                    options = table.Column<List<string>>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_field_definition", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_field_definition_field_scheme_scheme_uuid",
                        column: x => x.scheme_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "field_scheme",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_project_field_scheme_uuid",
                schema: "taskmgmt",
                table: "project",
                column: "field_scheme_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_date_1",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "date_1" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_date_2",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "date_2" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_num_1",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "num_1" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_num_2",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "num_2" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_text_1",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "text_1" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_text_2",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "text_2" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_user_1",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "user_1" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_user_2",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "user_2" });

            migrationBuilder.CreateIndex(
                name: "ix_field_definition_scheme_uuid_code",
                schema: "taskmgmt",
                table: "field_definition",
                columns: new[] { "scheme_uuid", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_field_definition_scheme_uuid_slot",
                schema: "taskmgmt",
                table: "field_definition",
                columns: new[] { "scheme_uuid", "slot" },
                unique: true,
                filter: "slot <> 'None'");

            migrationBuilder.AddForeignKey(
                name: "fk_project_field_scheme_field_scheme_uuid",
                schema: "taskmgmt",
                table: "project",
                column: "field_scheme_uuid",
                principalSchema: "taskmgmt",
                principalTable: "field_scheme",
                principalColumn: "uuid",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_project_field_scheme_field_scheme_uuid",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropTable(
                name: "field_definition",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "field_scheme",
                schema: "taskmgmt");

            migrationBuilder.DropIndex(
                name: "ix_project_field_scheme_uuid",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_date_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_date_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_num_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_num_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_text_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_text_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_user_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropIndex(
                name: "ix_issue_project_uuid_user_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "field_scheme_uuid",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "custom_fields",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "date_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "date_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "date_3",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "date_4",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "num_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "num_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "num_3",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "num_4",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "text_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "text_2",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "text_3",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "text_4",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "user_1",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "user_2",
                schema: "taskmgmt",
                table: "issue");
        }
    }
}
