using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations;

/// <summary>Wymagania pól są własnością krawędzi automatu, więc przechowujemy je przy
/// <c>workflow_transition</c>, a nie przy globalnej definicji pola.</summary>
public partial class WorkflowTransitionRequiredFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "required_field_codes",
            schema: "taskmgmt",
            table: "workflow_transition",
            type: "jsonb",
            nullable: false,
            defaultValueSql: "'[]'::jsonb");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "required_field_codes",
            schema: "taskmgmt",
            table: "workflow_transition");
    }
}
