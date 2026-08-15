using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "catalog");

            migrationBuilder.CreateTable(
                name: "category",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    parent_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_category", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "category_closure",
                schema: "catalog",
                columns: table => new
                {
                    ancestor_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    descendant_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    depth = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_category_closure", x => new { x.ancestor_uuid, x.descendant_uuid });
                });

            migrationBuilder.CreateTable(
                name: "job",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    command_type = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    command_json = table.Column<string>(type: "jsonb", nullable: true),
                    queue_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    client_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ui_metadata = table.Column<string>(type: "jsonb", nullable: true),
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
                name: "model",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_model", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "multimedia",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    media_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    thumbnail_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    original_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    mime_type = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_multimedia", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "product",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    sku = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ean = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    available_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    model_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    duplicate_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    image = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    attr_weight = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    attr_color = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "warranty",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    duration_months = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_warranty", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "job_item",
                schema: "catalog",
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
                        principalSchema: "catalog",
                        principalTable: "job",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_category",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    product_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    category_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_category", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_product_category_product_product_uuid",
                        column: x => x.product_uuid,
                        principalSchema: "catalog",
                        principalTable: "product",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_multimedia",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    product_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    multimedia_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_multimedia", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_product_multimedia_product_product_uuid",
                        column: x => x.product_uuid,
                        principalSchema: "catalog",
                        principalTable: "product",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_warranty",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    product_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    warranty_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    duration_months = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_warranty", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_product_warranty_product_product_uuid",
                        column: x => x.product_uuid,
                        principalSchema: "catalog",
                        principalTable: "product",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_category_name",
                schema: "catalog",
                table: "category",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_category_parent_uuid_name",
                schema: "catalog",
                table: "category",
                columns: new[] { "parent_uuid", "name" });

            migrationBuilder.CreateIndex(
                name: "ix_category_closure_ancestor_uuid_depth",
                schema: "catalog",
                table: "category_closure",
                columns: new[] { "ancestor_uuid", "depth" });

            migrationBuilder.CreateIndex(
                name: "ix_category_closure_descendant_uuid_depth",
                schema: "catalog",
                table: "category_closure",
                columns: new[] { "descendant_uuid", "depth" });

            migrationBuilder.CreateIndex(
                name: "ix_job_queue_id",
                schema: "catalog",
                table: "job",
                column: "queue_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_status_created_at",
                schema: "catalog",
                table: "job",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_job_user_id",
                schema: "catalog",
                table: "job",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_item_job_uuid_error_code",
                schema: "catalog",
                table: "job_item",
                columns: new[] { "job_uuid", "error_code" });

            migrationBuilder.CreateIndex(
                name: "ix_job_item_job_uuid_status_ordinal",
                schema: "catalog",
                table: "job_item",
                columns: new[] { "job_uuid", "status", "ordinal" });

            migrationBuilder.CreateIndex(
                name: "ix_model_name",
                schema: "catalog",
                table: "model",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_multimedia_created_at",
                schema: "catalog",
                table: "multimedia",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_multimedia_file_name",
                schema: "catalog",
                table: "multimedia",
                column: "file_name");

            migrationBuilder.CreateIndex(
                name: "ix_product_available_from",
                schema: "catalog",
                table: "product",
                column: "available_from");

            migrationBuilder.CreateIndex(
                name: "ix_product_duplicate_key",
                schema: "catalog",
                table: "product",
                column: "duplicate_key",
                unique: true,
                filter: "duplicate_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_product_ean",
                schema: "catalog",
                table: "product",
                column: "ean");

            migrationBuilder.CreateIndex(
                name: "ix_product_model_uuid",
                schema: "catalog",
                table: "product",
                column: "model_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_name",
                schema: "catalog",
                table: "product",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_product_price",
                schema: "catalog",
                table: "product",
                column: "price");

            migrationBuilder.CreateIndex(
                name: "ix_product_sku",
                schema: "catalog",
                table: "product",
                column: "sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_status",
                schema: "catalog",
                table: "product",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_product_category_category_uuid",
                schema: "catalog",
                table: "product_category",
                column: "category_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_category_product_uuid_category_uuid",
                schema: "catalog",
                table: "product_category",
                columns: new[] { "product_uuid", "category_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_multimedia_multimedia_uuid",
                schema: "catalog",
                table: "product_multimedia",
                column: "multimedia_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_multimedia_product_uuid_multimedia_uuid",
                schema: "catalog",
                table: "product_multimedia",
                columns: new[] { "product_uuid", "multimedia_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_warranty_product_uuid_warranty_uuid",
                schema: "catalog",
                table: "product_warranty",
                columns: new[] { "product_uuid", "warranty_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_warranty_warranty_uuid",
                schema: "catalog",
                table: "product_warranty",
                column: "warranty_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_warranty_name",
                schema: "catalog",
                table: "warranty",
                column: "name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "category",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "category_closure",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "job_item",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "model",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "multimedia",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "product_category",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "product_multimedia",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "product_warranty",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "warranty",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "job",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "product",
                schema: "catalog");
        }
    }
}
