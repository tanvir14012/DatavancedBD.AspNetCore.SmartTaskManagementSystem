using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Data.EfCore.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProjectTaskTablePartitioning : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE PARTITION FUNCTION PF_ProjectTasksCreatedAt(datetime2)
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
                CREATE PARTITION SCHEME PS_ProjectTasksCreatedAt
                AS PARTITION PF_ProjectTasksCreatedAt
                ALL TO ([PRIMARY]);
                """);

            // Remove FK dependency before replacing table
            migrationBuilder.Sql("""
                ALTER TABLE [stms].[UserTasks]
                DROP CONSTRAINT [FK_UserTasks_ProjectTasks_TaskId];
                """);

            // Create new table
            migrationBuilder.Sql("""
                CREATE TABLE [stms].[ProjectTasks_New]
                (
                    [Id] INT IDENTITY(1,1) NOT NULL,
                    [Title] NVARCHAR(200) NOT NULL,
                    [Description] NVARCHAR(4000) NULL,
                    [Status] INT NOT NULL,
                    [Priority] INT NOT NULL,
                    [DueDate] DATE NULL,
                    [ProjectId] INT NOT NULL,
                    [IsDeleted] BIT NOT NULL,
                    [SearchVector] AS LOWER(ISNULL([Title], '') + ' ' + ISNULL([Description], '')) PERSISTED,
                    [CreatedAt] DATETIME2 NOT NULL,
                    [CreatedById] INT NULL,
                    [UpdatedAt] DATETIME2 NULL,
                    [UpdatedById] INT NULL,
                    CONSTRAINT [PK_ProjectTasks_New] PRIMARY KEY NONCLUSTERED ([Id])
                )
                ON [PRIMARY];
                """);

            // Partitioned clustered index
            migrationBuilder.Sql("""
                CREATE UNIQUE CLUSTERED INDEX [CX_ProjectTasks_New]
                ON [stms].[ProjectTasks_New] ([Id], [CreatedAt])
                ON PS_ProjectTasksCreatedAt([CreatedAt]);
                """);

            // Copy existing data
            migrationBuilder.Sql("""
                SET IDENTITY_INSERT [stms].[ProjectTasks_New] ON;

                INSERT INTO [stms].[ProjectTasks_New]
                (Id, Title, Description, Status, Priority, DueDate, ProjectId, IsDeleted, CreatedAt, CreatedById, UpdatedAt, UpdatedById)
                SELECT Id, Title, Description, Status, Priority, DueDate, ProjectId, IsDeleted, CreatedAt, CreatedById, UpdatedAt, UpdatedById
                FROM [stms].[ProjectTasks];

                SET IDENTITY_INSERT [stms].[ProjectTasks_New] OFF;
                """);

            // Remove old table
            migrationBuilder.Sql("DROP TABLE [stms].[ProjectTasks];");

            // Rename new table
            migrationBuilder.Sql("""
                EXEC sp_rename 'stms.ProjectTasks_New', 'ProjectTasks';
                """);

            // Rename constraints/index
            migrationBuilder.Sql("""
                EXEC sp_rename 'stms.ProjectTasks.PK_ProjectTasks_New', 'PK_ProjectTasks';
                EXEC sp_rename 'stms.ProjectTasks.CX_ProjectTasks_New', 'CX_ProjectTasks';
                """);

            // Restore foreign keys
            migrationBuilder.Sql("""
                ALTER TABLE [stms].[UserTasks]
                ADD CONSTRAINT [FK_UserTasks_ProjectTasks_TaskId]
                FOREIGN KEY([TaskId]) REFERENCES [stms].[ProjectTasks]([Id]) ON DELETE CASCADE;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE [stms].[ProjectTasks]
                ADD CONSTRAINT [FK_ProjectTasks_Projects_ProjectId]
                FOREIGN KEY([ProjectId]) REFERENCES [stms].[Projects]([Id]) ON DELETE CASCADE;

                ALTER TABLE [stms].[ProjectTasks]
                ADD CONSTRAINT [FK_ProjectTasks_Users_CreatedById]
                FOREIGN KEY([CreatedById]) REFERENCES [stms].[Users]([Id]) ON DELETE NO ACTION;
                """);

            // Restore indexes
            migrationBuilder.Sql("""
                CREATE INDEX [IX_ProjectTasks_CreatedById] ON [stms].[ProjectTasks]([CreatedById]);
                CREATE INDEX [IX_ProjectTasks_DueDate] ON [stms].[ProjectTasks]([DueDate]);
                CREATE INDEX [IX_ProjectTasks_ProjectId_Status_Priority] ON [stms].[ProjectTasks]([ProjectId], [Status], [Priority]);
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE [stms].[UserTasks]
                DROP CONSTRAINT [FK_UserTasks_ProjectTasks_TaskId];
                """);

            migrationBuilder.Sql("""
                DROP TABLE [stms].[ProjectTasks];
                DROP PARTITION SCHEME PS_ProjectTasksCreatedAt;
                DROP PARTITION FUNCTION PF_ProjectTasksCreatedAt;
                """);
        }
    }
}
