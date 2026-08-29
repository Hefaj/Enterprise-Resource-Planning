using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations;

public partial class ProjectSlaPolicy : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "sla_policy",
            schema: "taskmgmt",
            columns: table => new
            {
                project_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                response_minutes = table.Column<int>(type: "integer", nullable: true),
                resolution_minutes = table.Column<int>(type: "integer", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_sla_policy", column => column.project_uuid);
                table.ForeignKey(
                    name: "fk_sla_policy_project_project_uuid",
                    column: column => column.project_uuid,
                    principalSchema: "taskmgmt",
                    principalTable: "project",
                    principalColumn: "uuid",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.AddColumn<DateOnly>(
            name: "sla_last_notified_on",
            schema: "taskmgmt",
            table: "issue",
            type: "date",
            nullable: true);

        migrationBuilder.DropIndex(name: "ix_issue_due_at", schema: "taskmgmt", table: "issue");
        migrationBuilder.CreateIndex(
            name: "ix_issue_due_at",
            schema: "taskmgmt",
            table: "issue",
            column: "due_at",
            filter: "due_at IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "ix_issue_due_at", schema: "taskmgmt", table: "issue");
        migrationBuilder.CreateIndex(name: "ix_issue_due_at", schema: "taskmgmt", table: "issue", column: "due_at");
        migrationBuilder.DropColumn(name: "sla_last_notified_on", schema: "taskmgmt", table: "issue");
        migrationBuilder.DropTable(name: "sla_policy", schema: "taskmgmt");
    }
}
