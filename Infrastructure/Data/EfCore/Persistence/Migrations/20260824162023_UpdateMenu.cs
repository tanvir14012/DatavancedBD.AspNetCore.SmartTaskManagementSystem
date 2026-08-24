using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Data.EfCore.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateMenu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "stms",
                table: "MenuItems",
                columns: new[] { "Id", "CreatedAt", "CreatedById", "DisplayOrder", "Icon", "Name", "ParentId", "Route", "Type", "UpdatedAt", "UpdatedById" },
                values: new object[] { 41, new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), null, 3, "people", "Assign Member", 2, "/projects/assign", 2, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "stms",
                table: "MenuItems",
                keyColumn: "Id",
                keyValue: 41);
        }
    }
}
