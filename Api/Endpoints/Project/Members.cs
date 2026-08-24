using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Project;

public sealed class Members : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapGet("/assignments", GetAssignments)
            .WithName("GetProjectAssignments")
            .WithSummary("Get project assignments with search, filter and pagination")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));

        group.MapGet("/{id:int}/members", GetMembers)
            .WithName("GetProjectMembers")
            .WithSummary("Get project members")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));

        group.MapPost("/{id:int}/members", AssignMember)
            .WithName("AssignProjectMember")
            .WithSummary("Assign a user to a project")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));

        group.MapDelete("/{id:int}/members/{userId:int}", RemoveMember)
            .WithName("RemoveProjectMember")
            .WithSummary("Remove a user from a project")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> GetAssignments(
        AppDbContext dbContext,
        ICurrentUser currentUser,
        [FromQuery] int start = 0,
        [FromQuery] int length = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] int? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.UserProjects
            .AsNoTracking()
            .Include(x => x.Project)
            .Include(x => x.User)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            query = query.Where(x => x.Project.Members.Any(member =>
                member.UserId == currentUser.UserId && (member.ProjectRole == ProjectRole.Manager || member.ProjectRole == ProjectRole.Owner)));
        }

        if (projectId.HasValue)
        {
            query = query.Where(x => x.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim();
            query = query.Where(x =>
                x.Project.Name.Contains(searchTerm) ||
                x.User.UserName.Contains(searchTerm) ||
                x.User.Email.Contains(searchTerm));
        }

        if (!string.IsNullOrWhiteSpace(role) && !string.Equals(role, "all", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<ProjectRole>(role, true, out var parsedRole))
            {
                query = query.Where(x => x.ProjectRole == parsedRole);
            }
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var assignments = await query
            .OrderBy(x => x.Project.Name)
            .ThenBy(x => x.User.UserName ?? x.User.Email)
            .Skip(Math.Max(start, 0))
            .Take(Math.Max(length, 1))
            .Select(x => new ProjectAssignmentSummary(
                x.ProjectId,
                x.Project.Name,
                x.UserId,
                x.User.UserName ?? x.User.Email ?? string.Empty,
                x.User.Email ?? string.Empty,
                x.ProjectRole))
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            page = (Math.Max(start, 0) / Math.Max(length, 1)) + 1,
            pageSize = Math.Max(length, 1),
            totalCount,
            filteredCount = totalCount,
            totalPages = (int)Math.Ceiling(totalCount / (double)Math.Max(length, 1)),
            items = assignments
        });
    }

    private static async Task<IResult> GetMembers(
        int id,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            return Results.NotFound();
        }

        var isAllowed = currentUser.IsInRole("Admin") ||
            await dbContext.UserProjects.AnyAsync(x => x.ProjectId == id && x.UserId == currentUser.UserId, cancellationToken);

        if (!isAllowed)
        {
            return Results.Forbid();
        }

        var members = await dbContext.UserProjects
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => x.ProjectId == id)
            .Select(x => new ProjectMemberSummary(x.UserId, x.User.UserName ?? x.User.Email ?? string.Empty, x.User.Email ?? string.Empty, x.ProjectRole))
            .OrderBy(x => x.Role)
            .ThenBy(x => x.UserName)
            .ToListAsync(cancellationToken);

        return Results.Ok(members);
    }

    private static async Task<IResult> AssignMember(
        int id,
        [FromBody] AssignProjectMemberRequest request,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            return Results.NotFound();
        }

        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = !isAdmin && project.Members.Any(m => m.UserId == currentUser.UserId && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            return Results.Forbid();
        }

        if (!isAdmin && request.Role == ProjectRole.Manager)
        {
            return Results.Forbid();
        }

        var userExists = await dbContext.Users.AnyAsync(u => u.Id == request.UserId, cancellationToken);
        if (!userExists)
        {
            return Results.NotFound();
        }

        var currentMembership = await dbContext.UserProjects
            .SingleOrDefaultAsync(x => x.ProjectId == id && x.UserId == request.UserId, cancellationToken);

        if (currentMembership is null)
        {
            dbContext.UserProjects.Add(new UserProject
            {
                ProjectId = id,
                UserId = request.UserId,
                ProjectRole = request.Role,
                JoinedAt = DateTime.UtcNow
            });
        }
        else
        {
            currentMembership.ProjectRole = request.Role;
            currentMembership.JoinedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { projectId = id, userId = request.UserId, role = request.Role });
    }

    private static async Task<IResult> RemoveMember(
        int id,
        int userId,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            return Results.NotFound();
        }

        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = !isAdmin && project.Members.Any(m => m.UserId == currentUser.UserId && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            return Results.Forbid();
        }

        var membership = await dbContext.UserProjects
            .SingleOrDefaultAsync(x => x.ProjectId == id && x.UserId == userId, cancellationToken);

        if (membership is null)
        {
            return Results.NotFound();
        }

        dbContext.UserProjects.Remove(membership);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}

public sealed record AssignProjectMemberRequest(int UserId, ProjectRole Role);
public sealed record ProjectAssignmentSummary(int ProjectId, string ProjectName, int UserId, string UserName, string Email, ProjectRole Role);