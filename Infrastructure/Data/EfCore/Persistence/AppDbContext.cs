using Application.Interfaces;
using Domain;
using Infrastructure.AssemblyScan;
using Infrastructure.Data.EfCore.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data.EfCore.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : ServiceDbContext(options, Shared.Constants.ServicePrefix), IAppDbContext, IScopedService
{
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectTask> ProjectTasks => Set<ProjectTask>();
    public DbSet<UserProject> UserProjects => Set<UserProject>();
    public DbSet<UserTask> UserTasks => Set<UserTask>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var tableName = entityType.GetTableName();
            if (tableName != null && tableName.StartsWith("AspNet"))
            {
                // Converts 'AspNetUsers' -> 'Users', 'AspNetUserRoles' -> 'UserRoles', etc.
                entityType.SetTableName(tableName[6..]);
            }
        }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return await base.SaveChangesAsync(ct);
    }
}
