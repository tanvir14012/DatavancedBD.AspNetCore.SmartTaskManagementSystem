using Domain;
using Domain.Enums;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Data.EfCore.Persistence.Seeding;
public static class SeedingExtensions
{
    public static async Task SeedProjectsAndTasksAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var dbContext = services.GetRequiredService<AppDbContext>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        // Guard: Skip execution if projects already exist
        if (await dbContext.Projects.AnyAsync())
        {
            return;
        }

        // Fetch seeded users
        var adminUser = await userManager.FindByEmailAsync(Shared.Constants.DefaultAdminEmail);
        var pmUser = await userManager.FindByEmailAsync(Shared.Constants.DefaultProjectManagerEmail);
        var memberUser = await userManager.FindByEmailAsync(Shared.Constants.DefaultMemberEmail);

        if (adminUser == null || pmUser == null || memberUser == null)
        {
            return; // SeedRolesAndAdminAsync must be executed prior to this call
        }

        // ==========================================
        // 1. CREATE PROJECTS
        // ==========================================
        var project1 = new Project
        {
            Name = "Enterprise Portal Redesign",
            Description = "Modernizing corporate web application using Angular 18 and Clean Architecture .NET APIs.",
            CreatedById = pmUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        var project2 = new Project
        {
            Name = "Internal Analytics Platform",
            Description = "A centralized real-time metric dashboard for leadership and department heads.",
            CreatedById = adminUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        await dbContext.Projects.AddRangeAsync(project1, project2);
        await dbContext.SaveChangesAsync();

        // ==========================================
        // 2. ASSIGN USER-PROJECT MEMBERSHIPS
        // ==========================================
        var userProjects = new List<UserProject>
        {
            new() { ProjectId = project1.Id, UserId = pmUser.Id },
            new() { ProjectId = project1.Id, UserId = memberUser.Id },
            new() { ProjectId = project2.Id, UserId = adminUser.Id },
            new() { ProjectId = project2.Id, UserId = pmUser.Id }
        };

        await dbContext.UserProjects.AddRangeAsync(userProjects);

        // ==========================================
        // 3. CREATE PROJECT TASKS
        // ==========================================
        var task1 = new ProjectTask
        {
            ProjectId = project1.Id,
            Title = "Setup Angular Workspace & Sidenav",
            Description = "Configure Angular Standalone Application with Material Sidenav navigation tree.",
            Status = ProjectTaskStatus.InProgress,
            Priority = TaskPriority.High,
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            CreatedById = pmUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        var task2 = new ProjectTask
        {
            ProjectId = project1.Id,
            Title = "Integrate GitHub Models AI Service",
            Description = "Implement endpoint for dynamic task description enhancements using AI SDK.",
            Status = ProjectTaskStatus.Todo,
            Priority = TaskPriority.Medium,
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
            CreatedById = pmUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        var task3 = new ProjectTask
        {
            ProjectId = project2.Id,
            Title = "Database Migration & Seed Automation",
            Description = "Configure EF Core migration scripts and initialize role/user database seeds.",
            Status = ProjectTaskStatus.Completed,
            Priority = TaskPriority.Critical,
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            CreatedById = adminUser.Id,
            CreatedAt = DateTime.UtcNow
        };

        await dbContext.ProjectTasks.AddRangeAsync(task1, task2, task3);
        await dbContext.SaveChangesAsync();

        // ==========================================
        // 4. ASSIGN USER-TASK ASSIGNEES
        // ==========================================
        var userTasks = new List<UserTask>
        {
            new() { TaskId = task1.Id, UserId = memberUser.Id, AssignedById = pmUser.Id },
            new() { TaskId = task2.Id, UserId = memberUser.Id, AssignedById = pmUser.Id },
            new() { TaskId = task3.Id, UserId = pmUser.Id, AssignedById = adminUser.Id }
        };

        await dbContext.UserTasks.AddRangeAsync(userTasks);
        await dbContext.SaveChangesAsync();
    }

    public static async Task SeedRolesAndAdminAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var roleManager = services.GetRequiredService<RoleManager<AppRole>>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        // Create roles if they don't exist
        foreach (var role in Shared.Constants.Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new AppRole(role));
            }
        }

        var adminUser = await userManager.FindByEmailAsync(Shared.Constants.DefaultAdminEmail);
        if (adminUser == null)
        {
            adminUser = new AppUser
            {
                UserName = Shared.Constants.DefaultAdminEmail,
                Email = Shared.Constants.DefaultAdminEmail,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(adminUser, Shared.Constants.DefaultPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, Shared.Constants.Roles.First());
            }
        }

        var pmUser = await userManager.FindByEmailAsync(Shared.Constants.DefaultProjectManagerEmail);
        if (pmUser == null)
        {
            pmUser = new AppUser
            {
                UserName = Shared.Constants.DefaultProjectManagerEmail,
                Email = Shared.Constants.DefaultProjectManagerEmail,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(pmUser, Shared.Constants.DefaultPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(pmUser, Shared.Constants.Roles[1]);
            }
        }

        var memberUser = await userManager.FindByEmailAsync(Shared.Constants.DefaultMemberEmail);
        if (memberUser == null)
        {
            memberUser = new AppUser
            {
                UserName = Shared.Constants.DefaultMemberEmail,
                Email = Shared.Constants.DefaultMemberEmail,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(memberUser, Shared.Constants.DefaultPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(memberUser, Shared.Constants.Roles.Last());
            }
        }
    }
}
