using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SavedViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "saved_view",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    filter_json = table.Column<string>(type: "text", nullable: false),
                    sort_json = table.Column<string>(type: "text", nullable: true),
                    mode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    columns = table.Column<List<string>>(type: "text[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saved_view", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_saved_view_owner_user_uuid",
                schema: "taskmgmt",
                table: "saved_view",
                column: "owner_user_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_saved_view_project_uuid",
                schema: "taskmgmt",
                table: "saved_view",
                column: "project_uuid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "saved_view",
                schema: "taskmgmt");
        }
    }
}
