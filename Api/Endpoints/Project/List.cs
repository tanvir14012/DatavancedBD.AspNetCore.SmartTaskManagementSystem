using Application.Features.Project.List;
using Infrastructure.Bootstrap;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Project;

public sealed class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects")
            .WithTags("Projects");

        group.MapGet("/", GetProjects)
            .WithName("GetProjects")
            .WithSummary("Get projects with search, sort and paging")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetProjects(
        [FromServices] ISender sender,
        [FromQuery] string? search = null,
        [FromQuery] string? sortColumn = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int start = 0,
        [FromQuery] int length = 20,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var response = await sender.Send(new Query(search, sortColumn, sortDirection, start, length, status), cancellationToken);

        return Results.Ok(new
        {
            page = response.Page,
            pageSize = response.PageSize,
            totalCount = response.TotalCount,
            filteredCount = response.FilteredCount,
            totalPages = response.TotalPages,
            items = response.Items.Select(item => new
            {
                id = item.Id,
                name = item.Name,
                description = item.Description,
                startDate = item.StartDate,
                endDate = item.EndDate,
                createdAt = item.CreatedAt,
                updatedAt = item.UpdatedAt,
                canEdit = item.CanEdit,
                canDelete = item.CanDelete,
                status = item.Status,
                role = item.Role,
                taskCount = item.TaskCount,
                currentUserRole = item.CurrentUserRole,
            })
        });
    }
}

