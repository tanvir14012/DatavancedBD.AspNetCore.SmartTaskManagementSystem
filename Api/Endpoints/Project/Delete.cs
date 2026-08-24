using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Project;

public sealed class Delete : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapDelete("/{id:int}", DeleteProject)
            .WithName("DeleteProject")
            .WithSummary("Soft delete a project")
            .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static async Task<IResult> DeleteProject(
        int id,
        AppDbContext dbContext,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (!currentUser.IsInRole("Admin"))
        {
            return Results.Forbid();
        }

        var project = await dbContext.Projects
            .SingleOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            return Results.NotFound();
        }

        project.IsDeleted = true;
        project.UpdatedAt = DateTime.UtcNow;
        project.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
