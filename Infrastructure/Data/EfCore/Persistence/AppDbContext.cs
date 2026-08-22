using Infrastructure.Data.EfCore.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data.EfCore.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : ServiceDbContext(options, Shared.Constants.ServicePrefix), IAppDbContext
{
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
