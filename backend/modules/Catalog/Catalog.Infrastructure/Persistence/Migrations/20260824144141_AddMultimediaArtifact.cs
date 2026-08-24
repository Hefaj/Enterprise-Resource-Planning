using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMultimediaArtifact : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "original_url",
                schema: "catalog",
                table: "multimedia",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(2048)",
                oldMaxLength: 2048);

            migrationBuilder.AddColumn<Guid>(
                name: "artifact_uuid",
                schema: "catalog",
                table: "multimedia",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_multimedia_artifact_uuid",
                schema: "catalog",
                table: "multimedia",
                column: "artifact_uuid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_multimedia_artifact_uuid",
                schema: "catalog",
                table: "multimedia");

            migrationBuilder.DropColumn(
                name: "artifact_uuid",
                schema: "catalog",
                table: "multimedia");

            migrationBuilder.AlterColumn<string>(
                name: "original_url",
                schema: "catalog",
                table: "multimedia",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(2048)",
                oldMaxLength: 2048,
                oldNullable: true);
        }
    }
}
