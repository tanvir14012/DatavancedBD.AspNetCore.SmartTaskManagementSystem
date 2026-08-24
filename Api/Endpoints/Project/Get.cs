using Application.Features.Project.Get;
using Application.Interfaces;
using Domain.Enums;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Project;

public sealed class Get : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapGet("/{id:int}", GetProject)
            .WithName("GetProject")
            .WithSummary("Get project by id")
            .WithDescription("Gets a project by id. Uses cache first, then database.")
            .Produces<Response>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetProject(
        int id,
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        Infrastructure.Data.EfCore.Persistence.AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new Query(id), cancellationToken);

        var isAllowed = currentUser.IsInRole("Admin") ||
            (currentUser.UserId.HasValue &&
             await dbContext.UserProjects.AnyAsync(x => x.ProjectId == id && x.UserId == currentUser.UserId.Value, cancellationToken));

        if (!isAllowed)
        {
            return Results.Forbid();
        }

        var members = await dbContext.UserProjects
            .AsNoTracking()
            .Where(x => x.ProjectId == id)
            .Select(x => new ProjectMemberSummary(x.UserId, x.User.UserName ?? x.User.Email ?? string.Empty, x.User.Email ?? string.Empty, x.ProjectRole))
            .ToListAsync(cancellationToken);

        return Results.Ok(new ProjectDetailResponse(
            result.Id,
            result.Name,
            result.Description,
            result.StartDate,
            result.EndDate,
            result.CreatedAt,
            currentUser.IsInRole("Admin") || members.Any(x => x.UserId == currentUser.UserId && (x.Role == ProjectRole.Manager || x.Role == ProjectRole.Owner)),
            currentUser.IsInRole("Admin"),
            members));
    }
}

public sealed record ProjectMemberSummary(int UserId, string UserName, string Email, ProjectRole Role);
public sealed record ProjectDetailResponse(int Id, string Name, string? Description, DateOnly? StartDate, DateOnly? EndDate, DateTime CreatedAt, bool CanEdit, bool CanDelete, IReadOnlyList<ProjectMemberSummary> Members);
