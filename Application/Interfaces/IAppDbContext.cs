using Domain;
using Microsoft.EntityFrameworkCore;

namespace Application.Interfaces;

/// <summary>Persistence operations consumed by the current application scope.</summary>
public interface IAppDbContext
{
    /// <summary>Users for this application interfaces contract.</summary>
    DbSet<AppUser> Users { get; }
    /// <summary>Menu items for this application interfaces contract.</summary>
    DbSet<MenuItem> MenuItems { get; }
    /// <summary>Projects for this application interfaces contract.</summary>
    DbSet<Project> Projects { get; }
    /// <summary>Project tasks for this application interfaces contract.</summary>
    DbSet<ProjectTask> ProjectTasks { get; }
    /// <summary>User projects for this application interfaces contract.</summary>
    DbSet<UserProject> UserProjects { get; }
    /// <summary>User tasks for this application interfaces contract.</summary>
    DbSet<UserTask> UserTasks { get; }
    /// <summary>Refresh tokens for this application interfaces contract.</summary>
    DbSet<RefreshToken> RefreshTokens { get; }
    /// <summary>Persists changes made within this context's storage boundary.</summary>
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
