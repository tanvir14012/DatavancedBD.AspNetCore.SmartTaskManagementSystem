using Api.Validators;
using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Project;

public sealed class Update : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapPut("/{id:int}", UpdateProject)
            .WithName("UpdateProject")
            .WithSummary("Update an existing project")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager"));
    }

    private static async Task<IResult> UpdateProject(
        int id,
        [FromBody] UpdateProjectRequest request,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        ICacheService cacheService,
        CancellationToken cancellationToken)
    {
        // Validate input first
        var errors = new List<(string, string)>();

        // Validate Name
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors.Add(("name", "Project name is required."));
        }
        else if (request.Name.Length > ValidationHelper.MaxNameLength)
        {
            errors.Add(("name", $"Project name cannot exceed {ValidationHelper.MaxNameLength} characters."));
        }
        else if (!ValidationHelper.IsValidProjectName(request.Name))
        {
            errors.Add(("name", "Project name contains invalid characters. Only alphanumeric, spaces, and -_.&() are allowed."));
        }

        // Validate Description
        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Length > ValidationHelper.MaxDescriptionLength)
        {
            errors.Add(("description", $"Project description cannot exceed {ValidationHelper.MaxDescriptionLength} characters."));
        }

        // Validate StartDate
        if (request.StartDate.HasValue && ValidationHelper.IsPastDate(request.StartDate))
        {
            errors.Add(("startDate", "Start date cannot be in the past."));
        }

        // Validate EndDate
        if (request.EndDate.HasValue && ValidationHelper.IsPastDate(request.EndDate))
        {
            errors.Add(("endDate", "End date cannot be in the past."));
        }

        // Validate date range
        if (!ValidationHelper.IsValidDateRange(request.StartDate, request.EndDate))
        {
            errors.Add(("dates", "End date must be greater than or equal to start date."));
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(ValidationHelper.CreateValidationProblem(errors.ToArray()));
        }

        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            return Results.NotFound();
        }

        var canEdit = currentUser.IsInRole("Admin") ||
            project.Members.Any(m => m.UserId == currentUser.UserId && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!canEdit)
        {
            return Results.Forbid();
        }

        project.Name = request.Name.Trim();
        project.Description = request.Description?.Trim();
        project.StartDate = request.StartDate;
        project.EndDate = request.EndDate;
        project.IsArchived = request.IsArchived;
        project.UpdatedAt = DateTime.UtcNow;
        project.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("projects:list:*", cancellationToken);
        await cacheService.RemoveAsync($"ef:Project:{id}", cancellationToken);

        var members = await dbContext.UserProjects
            .AsNoTracking()
            .Where(x => x.ProjectId == id)
            .Select(x => new ProjectMemberSummary(x.UserId, x.User.UserName ?? x.User.Email ?? string.Empty, x.User.Email ?? string.Empty, x.ProjectRole))
            .ToListAsync(cancellationToken);

        return Results.Ok(new ProjectDetailResponse(
            project.Id,
            project.Name,
            project.Description,
            project.StartDate,
            project.EndDate,
            project.CreatedAt,
            currentUser.IsInRole("Admin") || members.Any(x => x.UserId == currentUser.UserId && (x.Role == ProjectRole.Manager || x.Role == ProjectRole.Owner)),
            currentUser.IsInRole("Admin"),
            members));
    }
}

public sealed record UpdateProjectRequest(
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsArchived);