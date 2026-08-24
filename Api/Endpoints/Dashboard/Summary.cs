using Application.Features.Dashboard;
using Domain.Enums;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.Dashboard;

public sealed class Summary : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dashboard")
            .WithTags("Dashboard");

        group.MapGet("/summary", GetSummary)
            .WithName("GetDashboardSummary")
            .WithSummary("Return totals, status breakdown, and urgent items")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetSummary(
        [FromQuery] int? projectId,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var projectQuery = dbContext.Projects.AsNoTracking().Where(p => !p.IsDeleted);
        if (projectId.HasValue)
        {
            projectQuery = projectQuery.Where(p => p.Id == projectId.Value);
        }

        var taskQuery = dbContext.ProjectTasks.AsNoTracking().Where(t => !t.IsDeleted);
        if (projectId.HasValue)
        {
            taskQuery = taskQuery.Where(t => t.ProjectId == projectId.Value);
        }

        var totalProjects = await projectQuery.CountAsync(cancellationToken);
        var totalTasks = await taskQuery.CountAsync(cancellationToken);
        var completedTasks = await taskQuery.CountAsync(t => t.Status == ProjectTaskStatus.Completed, cancellationToken);
        var pendingTasks = totalTasks - completedTasks;

        var statusBreakdown = await taskQuery
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var priorityBreakdown = await taskQuery
            .GroupBy(t => t.Priority)
            .Select(g => new { Priority = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var urgentTasks = await taskQuery
            .Where(t => t.DueDate.HasValue && t.DueDate.Value >= DateOnly.FromDateTime(DateTime.UtcNow)
                && t.DueDate.Value <= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)))
            .OrderBy(t => t.DueDate)
            .Take(10)
            .Select(t => new
            {
                t.Id,
                t.Title,
                Status = t.Status,
                Priority = t.Priority,
                t.DueDate,
                t.ProjectId
            })
            .ToListAsync(cancellationToken);

        var summary = new DashboardSummary(
            totalProjects,
            totalTasks,
            completedTasks,
            pendingTasks,
            statusBreakdown
                .Select(x => new KeyValuePair<string, int>(x.Status.ToString(), x.Count))
                .OrderBy(x => x.Key)
                .ToList(),
            priorityBreakdown
                .Select(x => new KeyValuePair<string, int>(x.Priority.ToString(), x.Count))
                .OrderBy(x => x.Key)
                .ToList(),
            urgentTasks
                .Select(x => new DashboardUrgentTask(
                    x.Id,
                    x.Title,
                    x.Status.ToString(),
                    x.Priority.ToString(),
                    x.DueDate,
                    x.ProjectId))
                .ToList());

        return Results.Ok(summary);
    }
}
