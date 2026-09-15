using Application.Interfaces;
using Domain;
using Infrastructure.AssemblyScan;
using Infrastructure.Data.EfCore.Extensions;
using Microsoft.EntityFrameworkCore;
using Application.Tenancy;
using Infrastructure.Tenancy.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Infrastructure.Data.EfCore.Persistence;

public sealed class AppDbContext : ServiceDbContext, IAppDbContext, IScopedService
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options, Shared.Constants.ServicePrefix) { }

    /// <summary>Admin-only context constructor for reviewed migrations on a configured target.</summary>
    public AppDbContext(DbContextOptions<AppDbContext> options, string schema) : base(options, schema) { }

    public AppDbContext(DbContextOptions<AppDbContext> options, TenantContext context, string schema)
        : base(options, schema)
    {
        ArgumentNullException.ThrowIfNull(context);
        _ = new TenantPlacement(context.Placement.TenantId, TenantIsolation.Schema,
            context.Placement.TargetId, schema, context.Placement.Region, context.Placement.Version, TenantLifecycle.Active);
        TenantId = context.Placement.TenantId;
        IsTenantStorage = true;
    }

    public Guid TenantId { get; }
    public bool IsTenantStorage { get; }
    public string StorageSchema => Schema;
    protected override bool IncludeModelSeeds => !IsTenantStorage;

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
        optionsBuilder.ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
    }

    public DbSet<AppUser> Users => Set<AppUser>();
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
        if (IsTenantStorage)
            TenantModelConfiguration.Apply(modelBuilder, this);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return await SaveChangesAsync(true, ct);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        GuardTenantWrites();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override int SaveChanges() => SaveChanges(true);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        GuardTenantWrites();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    private void GuardTenantWrites()
    {
        if (!IsTenantStorage) return;
        ChangeTracker.DetectChanges();
        foreach (var entry in ChangeTracker.Entries().Where(e =>
                     e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            var tenant = entry.Property("TenantId");
            if (entry.State == EntityState.Added && (Guid)tenant.CurrentValue! == Guid.Empty)
                tenant.CurrentValue = TenantId;
            if ((Guid)tenant.CurrentValue! != TenantId ||
                (entry.State != EntityState.Added && (Guid)tenant.OriginalValue! != TenantId))
                throw new InvalidOperationException("Cross-organization or unbound writes are forbidden.");
        }
    }
}
