using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialTaskManagementSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "taskmgmt");

            migrationBuilder.CreateTable(
                name: "idempotency_key",
                schema: "taskmgmt",
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
                schema: "taskmgmt",
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
                name: "project",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    workflow_scheme_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    is_public = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "workflow_scheme",
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
                    table.PrimaryKey("pk_workflow_scheme", x => x.uuid);
                });

            migrationBuilder.CreateTable(
                name: "job_item",
                schema: "taskmgmt",
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
                        principalSchema: "taskmgmt",
                        principalTable: "job",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "issue",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    priority = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    state_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    reporter_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    assignee_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    parent_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    is_restricted = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    previous_keys = table.Column<List<string>>(type: "text[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_project_project_uuid",
                        column: x => x.project_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "project",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "project_key_counter",
                schema: "taskmgmt",
                columns: table => new
                {
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    prefix = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    next_number = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_key_counter", x => x.project_uuid);
                    table.ForeignKey(
                        name: "fk_project_key_counter_project_project_uuid",
                        column: x => x.project_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "project",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_member",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    user_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_member", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_project_member_project_project_uuid",
                        column: x => x.project_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "project",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workflow_state",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    category = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    order_no = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_state", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_workflow_state_workflow_scheme_scheme_uuid",
                        column: x => x.scheme_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "workflow_scheme",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workflow_transition",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    from_state_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    to_state_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    name_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    required_permission = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workflow_transition", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_workflow_transition_workflow_scheme_scheme_uuid",
                        column: x => x.scheme_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "workflow_scheme",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_idempotency_key_expires_at",
                schema: "taskmgmt",
                table: "idempotency_key",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_issue_assignee_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "assignee_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_due_at",
                schema: "taskmgmt",
                table: "issue",
                column: "due_at");

            migrationBuilder.CreateIndex(
                name: "ix_issue_key",
                schema: "taskmgmt",
                table: "issue",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_issue_parent_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "parent_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_issue_project_uuid_state_uuid",
                schema: "taskmgmt",
                table: "issue",
                columns: new[] { "project_uuid", "state_uuid" });

            migrationBuilder.CreateIndex(
                name: "ix_issue_reporter_uuid",
                schema: "taskmgmt",
                table: "issue",
                column: "reporter_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_job_kind_status_created_at",
                schema: "taskmgmt",
                table: "job",
                columns: new[] { "kind", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_job_queue_id",
                schema: "taskmgmt",
                table: "job",
                column: "queue_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_user_id",
                schema: "taskmgmt",
                table: "job",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_job_item_job_uuid_error_code",
                schema: "taskmgmt",
                table: "job_item",
                columns: new[] { "job_uuid", "error_code" });

            migrationBuilder.CreateIndex(
                name: "ix_job_item_job_uuid_status_ordinal",
                schema: "taskmgmt",
                table: "job_item",
                columns: new[] { "job_uuid", "status", "ordinal" });

            migrationBuilder.CreateIndex(
                name: "ix_project_code",
                schema: "taskmgmt",
                table: "project",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_project_member_project_uuid_user_uuid",
                schema: "taskmgmt",
                table: "project_member",
                columns: new[] { "project_uuid", "user_uuid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_project_member_user_uuid",
                schema: "taskmgmt",
                table: "project_member",
                column: "user_uuid");

            migrationBuilder.CreateIndex(
                name: "ix_workflow_state_scheme_uuid_code",
                schema: "taskmgmt",
                table: "workflow_state",
                columns: new[] { "scheme_uuid", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_workflow_transition_scheme_uuid_from_state_uuid_to_state_uu",
                schema: "taskmgmt",
                table: "workflow_transition",
                columns: new[] { "scheme_uuid", "from_state_uuid", "to_state_uuid" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "idempotency_key",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "issue",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "job_item",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "project_key_counter",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "project_member",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "workflow_state",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "workflow_transition",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "job",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "project",
                schema: "taskmgmt");

            migrationBuilder.DropTable(
                name: "workflow_scheme",
                schema: "taskmgmt");
        }
    }
}
