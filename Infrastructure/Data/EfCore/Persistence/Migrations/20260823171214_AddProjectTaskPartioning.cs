using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Data.EfCore.Persistence.Migrations
{
    public partial class AddProjectTaskPartioning : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE PARTITION FUNCTION PF_ProjectTaskCreatedAt(datetime2)
                AS RANGE RIGHT FOR VALUES
                (
                    '2026-09-01',
                    '2026-10-01',
                    '2026-11-01',
                    '2026-12-01',
                    '2027-01-01'
                );
                """);


            migrationBuilder.Sql("""
                CREATE PARTITION SCHEME PS_ProjectTaskCreatedAt
                AS PARTITION PF_ProjectTaskCreatedAt
                ALL TO ([PRIMARY]);
                """);


            // Remove FK dependency before replacing table
            migrationBuilder.Sql("""
                ALTER TABLE [stms].[UserTask]
                DROP CONSTRAINT [FK_UserTask_ProjectTask_TaskId];
                """);


            // Create new table
            migrationBuilder.Sql("""
                CREATE TABLE [stms].[ProjectTask_New]
                (
                    [Id] INT IDENTITY(1,1) NOT NULL,

                    [Title] NVARCHAR(200) NOT NULL,

                    [Description] NVARCHAR(4000) NULL,

                    [Status] INT NOT NULL,

                    [Priority] INT NOT NULL,

                    [DueDate] DATE NULL,

                    [ProjectId] INT NOT NULL,

                    [IsDeleted] BIT NOT NULL,

                    [SearchVector] AS
                        LOWER(ISNULL([Title], '') + ' ' + ISNULL([Description], ''))
                        PERSISTED,

                    [CreatedAt] DATETIME2 NOT NULL,

                    [CreatedById] INT NULL,

                    [UpdatedAt] DATETIME2 NULL,

                    [UpdatedById] INT NULL,


                    CONSTRAINT [PK_ProjectTask_New]
                    PRIMARY KEY NONCLUSTERED
                    (
                        [Id]
                    )
                )
                ON [PRIMARY];
                """);


            // Partitioned clustered index
            migrationBuilder.Sql("""
                CREATE UNIQUE CLUSTERED INDEX [CX_ProjectTask_New]
                ON [stms].[ProjectTask_New]
                (
                    [Id],
                    [CreatedAt]
                )
                ON PS_ProjectTaskCreatedAt([CreatedAt]);
                """);


            // Copy existing data
            migrationBuilder.Sql("""
                SET IDENTITY_INSERT [stms].[ProjectTask_New] ON;


                INSERT INTO [stms].[ProjectTask_New]
                (
                    Id,
                    Title,
                    Description,
                    Status,
                    Priority,
                    DueDate,
                    ProjectId,
                    IsDeleted,
                    CreatedAt,
                    CreatedById,
                    UpdatedAt,
                    UpdatedById
                )
                SELECT
                    Id,
                    Title,
                    Description,
                    Status,
                    Priority,
                    DueDate,
                    ProjectId,
                    IsDeleted,
                    CreatedAt,
                    CreatedById,
                    UpdatedAt,
                    UpdatedById
                FROM [stms].[ProjectTask];


                SET IDENTITY_INSERT [stms].[ProjectTask_New] OFF;
                """);


            // Remove old table
            migrationBuilder.Sql("""
                DROP TABLE [stms].[ProjectTask];
                """);


            // Rename new table
            migrationBuilder.Sql("""
                EXEC sp_rename
                    'stms.ProjectTask_New',
                    'ProjectTask';
                """);


            // Rename constraints/index
            migrationBuilder.Sql("""
                EXEC sp_rename
                    'stms.ProjectTask.PK_ProjectTask_New',
                    'PK_ProjectTask';


                EXEC sp_rename
                    'stms.ProjectTask.CX_ProjectTask_New',
                    'CX_ProjectTask';
                """);


            // Restore foreign keys
            migrationBuilder.Sql("""
                ALTER TABLE [stms].[UserTask]
                ADD CONSTRAINT [FK_UserTask_ProjectTask_TaskId]
                FOREIGN KEY([TaskId])
                REFERENCES [stms].[ProjectTask]([Id])
                ON DELETE CASCADE;
                """);


            migrationBuilder.Sql("""
                ALTER TABLE [stms].[ProjectTask]
                ADD CONSTRAINT [FK_ProjectTask_Project]
                FOREIGN KEY([ProjectId])
                REFERENCES [stms].[Project]([Id])
                ON DELETE CASCADE;


                ALTER TABLE [stms].[ProjectTask]
                ADD CONSTRAINT [FK_ProjectTask_AppUser_CreatedById]
                FOREIGN KEY([CreatedById])
                REFERENCES [stms].[AppUser]([Id])
                ON DELETE NO ACTION;
                """);


            // Restore indexes
            migrationBuilder.Sql("""
                CREATE INDEX [IX_ProjectTask_CreatedById]
                ON [stms].[ProjectTask]
                (
                    [CreatedById]
                );


                CREATE INDEX [IX_ProjectTask_DueDate]
                ON [stms].[ProjectTask]
                (
                    [DueDate]
                );


                CREATE INDEX [IX_ProjectTask_ProjectId_Status_Priority]
                ON [stms].[ProjectTask]
                (
                    [ProjectId],
                    [Status],
                    [Priority]
                );


                CREATE INDEX [IX_ProjectTask_SearchVector]
                ON [stms].[ProjectTask]
                (
                    [SearchVector]
                )
                INCLUDE
                (
                    [ProjectId],
                    [Status],
                    [Priority]
                );
                """);
        }


        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE [stms].[UserTask]
                DROP CONSTRAINT [FK_UserTask_ProjectTask_TaskId];
                """);


            migrationBuilder.Sql("""
                DROP TABLE [stms].[ProjectTask];


                DROP PARTITION SCHEME PS_ProjectTaskCreatedAt;


                DROP PARTITION FUNCTION PF_ProjectTaskCreatedAt;
                """);
        }
    }
}
