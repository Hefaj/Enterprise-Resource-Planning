using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SearchSwimlaneArchiveAndLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_archived",
                schema: "taskmgmt",
                table: "project",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "wip_limit",
                schema: "taskmgmt",
                table: "board_column",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "swimlane_field_code",
                schema: "taskmgmt",
                table: "board",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            // Wartość domyślna MUSI być nazwą wariantu enuma ("None"), nie pustym stringiem —
            // istniejące tablice dostają ten domyślny wiersz, a `HasConversion<string>()` przy
            // odczycie próbowałby sparsować "" z powrotem na BoardSwimlaneMode i wybuchłby.
            migrationBuilder.AddColumn<string>(
                name: "swimlane_mode",
                schema: "taskmgmt",
                table: "board",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.CreateTable(
                name: "issue_external_link",
                schema: "taskmgmt",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    issue_uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    label = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_issue_external_link", x => x.uuid);
                    table.ForeignKey(
                        name: "fk_issue_external_link_issue_issue_uuid",
                        column: x => x.issue_uuid,
                        principalSchema: "taskmgmt",
                        principalTable: "issue",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_project_is_archived",
                schema: "taskmgmt",
                table: "project",
                column: "is_archived");

            migrationBuilder.CreateIndex(
                name: "ix_issue_external_link_issue_uuid",
                schema: "taskmgmt",
                table: "issue_external_link",
                column: "issue_uuid");

            // SRCH-003 — indeks GIN na wyrażeniu, nie na kolumnie generowanej: musi zgadzać się
            // DOSŁOWNIE z wyrażeniem w `IssueQueries.Filtered()`, inaczej planer Postgresa go
            // pominie. `simple` konfiguracja językowa (nie `polish`/`english`) — projekt nie
            // zakłada jednego języka treści zgłoszeń.
            migrationBuilder.Sql(
                """
                CREATE INDEX ix_issue_search_vector ON taskmgmt.issue
                    USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX ix_issue_comment_search_vector ON taskmgmt.issue_comment
                    USING GIN (to_tsvector('simple', body));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS taskmgmt.ix_issue_comment_search_vector;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS taskmgmt.ix_issue_search_vector;");

            migrationBuilder.DropTable(
                name: "issue_external_link",
                schema: "taskmgmt");

            migrationBuilder.DropIndex(
                name: "ix_project_is_archived",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "is_archived",
                schema: "taskmgmt",
                table: "project");

            migrationBuilder.DropColumn(
                name: "wip_limit",
                schema: "taskmgmt",
                table: "board_column");

            migrationBuilder.DropColumn(
                name: "swimlane_field_code",
                schema: "taskmgmt",
                table: "board");

            migrationBuilder.DropColumn(
                name: "swimlane_mode",
                schema: "taskmgmt",
                table: "board");
        }
    }
}
