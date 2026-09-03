using Application.Features.Project.Update;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

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
        [FromServices] ISender sender,
         IHttpResponseCacheInvalidator httpCacheInvalidator,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new Command(id, request.Name, request.Description, request.StartDate, request.EndDate, request.IsArchived), cancellationToken);
        await httpCacheInvalidator.InvalidateByRouteAsync("/api/projects", currentUser.UserId?.ToString(), cancellationToken);

        return Results.Ok(new ProjectDetailResponse(
            result.Id,
            result.Name,
            result.Description,
            result.StartDate,
            result.EndDate,
            result.CreatedAt,
            result.CanEdit,
            result.CanDelete,
            result.Members.Select(member => new ProjectMemberSummary(member.UserId, member.UserName, member.Email, member.Role)).ToList()));
    }
}

public sealed record UpdateProjectRequest(
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsArchived);
