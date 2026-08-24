using Application.Interfaces;
using Domain;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        AppDbContext dbContext,
        ICurrentUser currentUser,
        [FromQuery] string? search = null,
        [FromQuery] string? sortColumn = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int start = 0,
        [FromQuery] int length = 20,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            return Results.Unauthorized();
        }

        var query = dbContext.Projects
            .AsNoTracking()
            .Include(p => p.Members)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            var userId = currentUser.UserId.Value;
            query = query.Where(p => p.Members.Any(m => m.UserId == userId));
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var isArchived = string.Equals(status, "archived", StringComparison.OrdinalIgnoreCase);
            query = query.Where(p => p.IsArchived == isArchived);
        }

        var dataTableRequest = new DataTableRequest
        {
            Start = start,
            Length = length,
            Search = search,
            SortColumn = string.IsNullOrWhiteSpace(sortColumn) ? "CreatedAt" : sortColumn,
            SortDirection = string.IsNullOrWhiteSpace(sortDirection) ? "desc" : sortDirection,
        };

        var configuration = new DataTableQueryConfiguration { MaxPageSize = 200 };
        configuration.SearchableColumns.Add("Name");
        configuration.SearchableColumns.Add("Description");
        configuration.SortableColumns.Add("Name");
        configuration.SortableColumns.Add("StartDate");
        configuration.SortableColumns.Add("EndDate");
        configuration.SortableColumns.Add("CreatedAt");

        var page = await query.ToDataTablePageAsync(
            dbContext,
            dataTableRequest,
            p => new ProjectListItem(
                p.Id,
                p.Name,
                p.Description,
                p.StartDate,
                p.EndDate,
                p.CreatedAt,
                currentUser.IsInRole("Admin") || p.Members.Any(m => m.UserId == currentUser.UserId.Value && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)),
                currentUser.IsInRole("Admin"),
                p.IsArchived,
                p.Members.Where(m => m.UserId == currentUser.UserId.Value).Select(m => m.ProjectRole).FirstOrDefault()),
            configuration,
            cancellationToken);

        return Results.Ok(new
        {
            page = (start / Math.Max(length, 1)) + 1,
            pageSize = length,
            totalCount = page.TotalCount,
            filteredCount = page.FilteredCount,
            totalPages = (int)Math.Ceiling(page.FilteredCount / (double)Math.Max(length, 1)),
            items = page.Items
        });
    }
}

public sealed record ProjectListItem(
    int Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime CreatedAt,
    bool CanEdit,
    bool CanDelete,
    bool IsArchived,
    ProjectRole CurrentUserRole);
