using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations;

public partial class IssueStateCategoryForSla : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "state_category",
            schema: "taskmgmt",
            table: "issue",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE taskmgmt.issue AS issue
            SET state_category = state.category
            FROM taskmgmt.workflow_state AS state
            WHERE state.uuid = issue.state_uuid
            """);

        migrationBuilder.AlterColumn<string>(
            name: "state_category",
            schema: "taskmgmt",
            table: "issue",
            type: "character varying(16)",
            maxLength: 16,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(16)",
            oldMaxLength: 16,
            oldNullable: true);

        migrationBuilder.DropIndex(name: "ix_issue_due_at", schema: "taskmgmt", table: "issue");
        migrationBuilder.CreateIndex(
            name: "ix_issue_due_at",
            schema: "taskmgmt",
            table: "issue",
            column: "due_at",
            filter: "due_at IS NOT NULL AND state_category <> 'Done'");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "ix_issue_due_at", schema: "taskmgmt", table: "issue");
        migrationBuilder.CreateIndex(
            name: "ix_issue_due_at",
            schema: "taskmgmt",
            table: "issue",
            column: "due_at",
            filter: "due_at IS NOT NULL");
        migrationBuilder.DropColumn(name: "state_category", schema: "taskmgmt", table: "issue");
    }
}
