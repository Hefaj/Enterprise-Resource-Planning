using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIdempotencyKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "sales");

            migrationBuilder.CreateTable(
                name: "customer",
                schema: "sales",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customer", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "idempotency_key",
                schema: "sales",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    operation = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    result_json = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_idempotency_key", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "job",
                schema: "sales",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    command_type = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    command_json = table.Column<string>(type: "jsonb", nullable: true),
                    queue_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    client_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ui_metadata = table.Column<string>(type: "jsonb", nullable: true),
                    result_ref = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    total_count = table.Column<int>(type: "integer", nullable: false),
                    succeeded_count = table.Column<int>(type: "integer", nullable: false),
                    failed_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expire_on = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "job_item",
                schema: "sales",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    job_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    aggregate_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    command_json = table.Column<string>(type: "jsonb", nullable: true),
                    ordinal = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    error_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    error_message = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_job_item", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_job_item_job_job_uuid",
                        column: x => x.job_uuid,
                        principalSchema: "sales",
                        principalTable: "job",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_customer_email",
                schema: "sales",
                table: "customer",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_customer_name",
                schema: "sales",
                table: "customer",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_idempotency_key_expires_at",
                schema: "sales",
                table: "idempotency_key",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_job_kind_status_created_at",
                schema: "sales",
                table: "job",
                columns: new[] { "kind", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_job_queue_id",
                schema: "sales",
                table: "job",
                column: "queue_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_user_id",
                schema: "sales",
                table: "job",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_item_job_uuid_error_code",
                schema: "sales",
                table: "job_item",
                columns: new[] { "job_uuid", "error_code" });

            migrationBuilder.CreateIndex(
                name: "ix_job_item_job_uuid_status_ordinal",
                schema: "sales",
                table: "job_item",
                columns: new[] { "job_uuid", "status", "ordinal" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "customer",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "idempotency_key",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "job_item",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "job",
                schema: "sales");
        }
    }
}
