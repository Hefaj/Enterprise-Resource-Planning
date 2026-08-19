using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGrantAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "grant_audit",
                schema: "identity",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    actor_user_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    subject_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_code = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_grant_audit", x => x.uuid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_grant_audit_occurred_at",
                schema: "identity",
                table: "grant_audit",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "ix_grant_audit_subject_uuid",
                schema: "identity",
                table: "grant_audit",
                column: "subject_uuid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "grant_audit",
                schema: "identity");
        }
    }
}
