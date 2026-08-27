using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BoardsAndCardOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "board",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    mode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_board", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_board_project_project_uuid",
                        column: x => x.project_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "project",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "board_card",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    board_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    rank = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, collation: "C"),
                    sprint_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_board_card", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_board_card_board_board_uuid",
                        column: x => x.board_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "board",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_board_card_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "board_column",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    board_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    order_no = table.Column<int>(type: "integer", nullable: false),
                    state_uuids = table.Column<List<Guid>>(type: "uuid[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_board_column", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_board_column_board_board_uuid",
                        column: x => x.board_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "board",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_board_project_uuid",
                schema: "taskmgmt",
                table: "board",
                column: "project_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_board_card_board_uuid_issue_uuid",
                schema: "taskmgmt",
                table: "board_card",
                columns: new[] { "board_uuid", "issue_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_board_card_board_uuid_rank",
                schema: "taskmgmt",
                table: "board_card",
                columns: new[] { "board_uuid", "rank" });

            migrationBuilder.CreateIndex(
                name: "ix_board_card_issue_uuid",
                schema: "taskmgmt",
                table: "board_card",
                column: "issue_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_board_column_board_uuid_order_no",
                schema: "taskmgmt",
                table: "board_column",
                columns: new[] { "board_uuid", "order_no" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "board_card",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "board_column",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "board",
                schema: "taskmgmt");
        }
    }
}
