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
                name: "attribute_definition",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    data_type = table.Column<int>(type: "integer", nullable: false),
                    is_multi_value = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_attribute_definition", x => x.uuid);
                });

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
                name: "code_type",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    symbol = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    pattern = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    is_unique = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_code_type", x => x.uuid);
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
                    price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    available_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    model_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    duplicate_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    image = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
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
                name: "attribute_option",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    attribute_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_attribute_option", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_attribute_option_attribute_definition_attribute_uuid",
                        column: x => x.attribute_uuid,
                        principalSchema: "catalog",
                        principalTable: "attribute_definition",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
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
                name: "product_attribute_value",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    product_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    attribute_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    is_multi_value = table.Column<bool>(type: "boolean", nullable: false),
                    option_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    multimedia_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    value_text = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    value_number = table.Column<decimal>(type: "numeric(28,10)", nullable: true),
                    value_boolean = table.Column<bool>(type: "boolean", nullable: true),
                    value_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_attribute_value", x => x.uuid);
                    table.CheckConstraint("ck_product_attribute_value_payload", "(CASE WHEN option_uuid IS NOT NULL THEN 1 ELSE 0 END\n+ CASE WHEN multimedia_uuid IS NOT NULL THEN 1 ELSE 0 END\n+ CASE WHEN value_text IS NOT NULL THEN 1 ELSE 0 END\n+ CASE WHEN value_number IS NOT NULL THEN 1 ELSE 0 END\n+ CASE WHEN value_boolean IS NOT NULL THEN 1 ELSE 0 END\n+ CASE WHEN value_date IS NOT NULL THEN 1 ELSE 0 END) = 1");
                    table.ForeignKey(
                        name: "fk_product_attribute_value_product_product_uuid",
                        column: x => x.product_uuid,
                        principalSchema: "catalog",
                        principalTable: "product",
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
                name: "product_code",
                schema: "catalog",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    product_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code_type_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    value = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    unique_key = table.Column<string>(type: "character varying(192)", maxLength: 192, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_code", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_product_code_product_product_uuid",
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
                name: "ix_attribute_definition_code",
                schema: "catalog",
                table: "attribute_definition",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_attribute_definition_sort_order",
                schema: "catalog",
                table: "attribute_definition",
                column: "sort_order");

            migrationBuilder.CreateIndex(
                name: "ix_attribute_option_attribute_uuid_code",
                schema: "catalog",
                table: "attribute_option",
                columns: new[] { "attribute_uuid", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_attribute_option_attribute_uuid_sort_order",
                schema: "catalog",
                table: "attribute_option",
                columns: new[] { "attribute_uuid", "sort_order" });

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
                name: "ix_code_type_sort_order",
                schema: "catalog",
                table: "code_type",
                column: "sort_order");

            migrationBuilder.CreateIndex(
                name: "ix_code_type_symbol",
                schema: "catalog",
                table: "code_type",
                column: "symbol",
                unique: true);

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
                name: "ix_product_status",
                schema: "catalog",
                table: "product",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_product_attribute_value_attribute_uuid_value_date",
                schema: "catalog",
                table: "product_attribute_value",
                columns: new[] { "attribute_uuid", "value_date" });

            migrationBuilder.CreateIndex(
                name: "ix_product_attribute_value_attribute_uuid_value_number",
                schema: "catalog",
                table: "product_attribute_value",
                columns: new[] { "attribute_uuid", "value_number" });

            migrationBuilder.CreateIndex(
                name: "ix_product_attribute_value_multimedia_uuid",
                schema: "catalog",
                table: "product_attribute_value",
                column: "multimedia_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_attribute_value_option_uuid",
                schema: "catalog",
                table: "product_attribute_value",
                column: "option_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_attribute_value_product_uuid_sort_order",
                schema: "catalog",
                table: "product_attribute_value",
                columns: new[] { "product_uuid", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_product_attribute_value_single",
                schema: "catalog",
                table: "product_attribute_value",
                columns: new[] { "product_uuid", "attribute_uuid" },
                unique: true,
                filter: "is_multi_value = false");

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
                name: "ix_product_code_code_type_uuid",
                schema: "catalog",
                table: "product_code",
                column: "code_type_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_product_code_product_uuid_code_type_uuid_value",
                schema: "catalog",
                table: "product_code",
                columns: new[] { "product_uuid", "code_type_uuid", "value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_code_unique_key",
                schema: "catalog",
                table: "product_code",
                column: "unique_key",
                unique: true,
                filter: "unique_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_product_code_value",
                schema: "catalog",
                table: "product_code",
                column: "value");

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
                name: "attribute_option",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "category",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "category_closure",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "code_type",
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
                name: "product_attribute_value",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "product_category",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "product_code",
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
                name: "attribute_definition",
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
