using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Sprints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sprint",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    board_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    goal = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: true),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    activated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sprint", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_sprint_board_board_uuid",
                        column: x => x.board_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "board",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_board_card_sprint_uuid",
                schema: "taskmgmt",
                table: "board_card",
                column: "sprint_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_sprint_board_active",
                schema: "taskmgmt",
                table: "sprint",
                column: "board_uuid",
                unique: true,
                filter: "status = 'Active'");

            migrationBuilder.CreateIndex(
                name: "ix_sprint_board_status",
                schema: "taskmgmt",
                table: "sprint",
                columns: new[] { "board_uuid", "status" });

            migrationBuilder.AddForeignKey(
                name: "fk_board_card_sprint_sprint_uuid",
                schema: "taskmgmt",
                table: "board_card",
                column: "sprint_uuid",
                principalSchema: "taskmgmt",
                principalTable: "sprint",
                principalColumn: "uuid",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_board_card_sprint_sprint_uuid",
                schema: "taskmgmt",
                table: "board_card");

            migrationBuilder.DropTable(
                name: "sprint",
                schema: "taskmgmt");

            migrationBuilder.DropIndex(
                name: "ix_board_card_sprint_uuid",
                schema: "taskmgmt",
                table: "board_card");
        }
    }
}
