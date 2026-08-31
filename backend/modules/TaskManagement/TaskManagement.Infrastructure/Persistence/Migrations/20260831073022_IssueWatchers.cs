using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IssueWatchers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<Guid>>(
                name: "watchers",
                schema: "taskmgmt",
                table: "issue",
                type: "uuid[]",
                nullable: false,
                // Kolumna dokładana do istniejącej tabeli — bez wartości domyślnej Postgres
                // odrzuciłby NOT NULL na niepustym `issue`.
                defaultValueSql: "'{}'::uuid[]");

            migrationBuilder.CreateIndex(
                name: "ix_issue_watchers",
                schema: "taskmgmt",
                table: "issue",
                column: "watchers")
                .Annotation("Npgsql:IndexMethod", "gin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_issue_watchers",
                schema: "taskmgmt",
                table: "issue");

            migrationBuilder.DropColumn(
                name: "watchers",
                schema: "taskmgmt",
                table: "issue");
        }
    }
}
