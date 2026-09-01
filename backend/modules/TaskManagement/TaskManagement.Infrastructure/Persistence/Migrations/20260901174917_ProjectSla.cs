using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProjectSla : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "sla_resolution_minutes",
                schema: "taskmgmt",
                table: "project",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sla_response_minutes",
                schema: "taskmgmt",
                table: "project",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "sla_work_end_time",
                schema: "taskmgmt",
                table: "project",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "sla_work_start_time",
                schema: "taskmgmt",
                table: "project",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sla_working_days",
                schema: "taskmgmt",
                table: "project",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sla_resolution_minutes",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "sla_response_minutes",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "sla_work_end_time",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "sla_work_start_time",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "sla_working_days",
                schema: "taskmgmt",
                table: "project");
        }
    }
}
