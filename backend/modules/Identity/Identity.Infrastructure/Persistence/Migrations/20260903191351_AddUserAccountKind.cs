using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccountKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "identity",
                table: "user_account",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                schema: "identity",
                table: "user_account",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Human");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "description",
                schema: "identity",
                table: "user_account");

            migrationBuilder.DropColumn(
                name: "kind",
                schema: "identity",
                table: "user_account");
        }
    }
}
