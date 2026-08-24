using Infrastructure.Bootstrap;
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
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Projects
            .AsNoTracking()
            .Where(p => !p.IsDeleted)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Name.Contains(term) || (p.Description != null && p.Description.Contains(term)));
        }

        var sort = (sortBy ?? "createdAt").ToLowerInvariant();
        query = sort switch
        {
            "name" => query.OrderBy(p => p.Name),
            "startdate" => query.OrderBy(p => p.StartDate ?? DateOnly.MinValue),
            "enddate" => query.OrderBy(p => p.EndDate ?? DateOnly.MaxValue),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProjectListItem(
                p.Id,
                p.Name,
                p.Description,
                p.StartDate,
                p.EndDate,
                p.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            page,
            pageSize,
            totalCount,
            totalPages = (int)Math.Ceiling(totalCount / (double)Math.Max(pageSize, 1)),
            items
        });
    }
}

public sealed record ProjectListItem(
    int Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime CreatedAt);
