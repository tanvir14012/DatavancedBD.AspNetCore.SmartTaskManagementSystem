using Api.Services;
using Application.Features.Project.Members;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Mvc;

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
        [FromServices] ISender sender,
        [FromQuery] int start = 0,
        [FromQuery] int length = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] int? projectId = null,
        CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(new AssignmentsQuery(start, length, search, role, projectId), cancellationToken);

        return Results.Ok(new
        {
            page = result.Page,
            pageSize = result.PageSize,
            totalCount = result.TotalCount,
            filteredCount = result.FilteredCount,
            totalPages = result.TotalPages,
            items = result.Items
        });
    }

    private static async Task<IResult> GetMembers(
        int id,
        [FromServices] ISender sender,
        CancellationToken cancellationToken)
    {
        var members = await sender.Send(new MembersQuery(id), cancellationToken);
        return Results.Ok(members);
    }

    private static async Task<IResult> AssignMember(
        int id,
        [FromBody] AssignProjectMemberRequest request,
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        IHttpResponseCacheInvalidator httpCacheInvalidator,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new AssignCommand(id, request.UserId, request.Role), cancellationToken);
        await httpCacheInvalidator.InvalidateByRouteAsync($"/api/projects/assignments", currentUser.UserId?.ToString(), cancellationToken);
        await httpCacheInvalidator.InvalidateByRouteAsync($"/api/projects/{id}/members", currentUser.UserId?.ToString(), cancellationToken);
        return Results.Ok(new { projectId = result.ProjectId, userId = result.UserId, role = result.Role });
    }

    private static async Task<IResult> RemoveMember(
        int id,
        int userId,
        [FromServices] ISender sender,
        ICurrentUser currentUser,
        IHttpResponseCacheInvalidator httpCacheInvalidator,
        CancellationToken cancellationToken)
    {
        await sender.Send(new RemoveCommand(id, userId), cancellationToken);
        await httpCacheInvalidator.InvalidateByRouteAsync($"/api/projects/assignments", currentUser.UserId?.ToString(), cancellationToken);
        await httpCacheInvalidator.InvalidateByRouteAsync($"/api/projects/{id}/members", currentUser.UserId?.ToString(), cancellationToken);
        return Results.NoContent();
    }
}

public sealed record AssignProjectMemberRequest(int UserId, string Role);
