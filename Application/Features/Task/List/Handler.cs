using Application.Interfaces;
using Application.Models;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Task.List;

public sealed class Handler(IAppDbContext dbContext, ICurrentUser currentUser, ICacheService cacheService)
    : IRequestHandler<Query, Response>
{
    public async Task<Response> Handle(Query request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        var userId = currentUser.UserId.Value;
        var roleScope = currentUser.IsInRole("Admin")
            ? "admin"
            : currentUser.IsInRole("Project Manager")
                ? $"pm-{userId}"
                : $"member-{userId}";

        var cacheKey = $"tasks:list:{roleScope}:{request.ProjectId ?? 0}:{request.Status ?? "all"}:{request.Priority ?? "all"}:{request.AssigneeId ?? "all"}:{request.Search ?? string.Empty}:{request.Start}:{request.Length}:{request.SortColumn ?? "CreatedAt"}:{request.SortDirection ?? "desc"}";

        var cachedResponse = await cacheService.GetAsync<Response>(cacheKey, cancellationToken);
        if (cachedResponse is not null)
        {
            return cachedResponse;
        }

        IQueryable<Domain.ProjectTask> query = dbContext.ProjectTasks
            .AsNoTracking()
            .Include(t => t.Project)
            .ThenInclude(p => p.Members)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            if (currentUser.IsInRole("Project Manager"))
            {
                query = query.Where(t => t.Project.Members.Any(m =>
                    m.UserId == userId &&
                    (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)));
            }
            else
            {
                query = query.Where(t => t.Assignees.Any(a => a.UserId == userId));
            }
        }

        if (request.ProjectId.HasValue)
        {
            query = query.Where(t => t.ProjectId == request.ProjectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.AssigneeId) && int.TryParse(request.AssigneeId, out var assigneeId))
        {
            query = query.Where(t => t.Assignees.Any(a => a.UserId == assigneeId));
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<ProjectTaskStatus>(request.Status, true, out var status))
        {
            query = query.Where(t => t.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(request.Priority) && Enum.TryParse<TaskPriority>(request.Priority, true, out var priority))
        {
            query = query.Where(t => t.Priority == priority);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(t =>
                EF.Functions.Like(t.Title, $"%{search}%") ||
                (t.Description != null && EF.Functions.Like(t.Description, $"%{search}%")) ||
                EF.Functions.Like(t.Project.Name, $"%{search}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var pageSize = Math.Max(request.Length, 1);
        var pageIndex = Math.Max(request.Start, 0);

        query = ApplySort(query, request.SortColumn, request.SortDirection);

        var items = await query
            .Skip(pageIndex)
            .Take(pageSize)
            .Select(t => new
            {
                Id = t.Id,
                ProjectId = t.ProjectId,
                ProjectName = t.Project.Name,
                Title = t.Title,
                Description = t.Description,
                Status = t.Status,
                Priority = t.Priority,
                DueDate = t.DueDate,
                CreatedAt = t.CreatedAt,
                UserIsProjectManager = t.Project.Members.Any(m =>
                    m.UserId == userId &&
                    (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner))
            })
            .ToListAsync(cancellationToken);

        var responseItems = items.Select(item => new Item(
            item.Id,
            item.ProjectId,
            item.ProjectName,
            item.Title,
            item.Description,
            item.Status.ToString(),
            item.Priority.ToString(),
            item.DueDate?.ToString("yyyy-MM-dd"),
            item.CreatedAt,
            true,
            currentUser.IsInRole("Admin") || (currentUser.IsInRole("Project Manager") && item.UserIsProjectManager))).ToList();

        var response = new Response(
            (pageIndex / pageSize) + 1,
            pageSize,
            totalCount,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)pageSize),
            responseItems);

        await cacheService.SetAsync(
            cacheKey,
            response,
            new CacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(3) },
            cancellationToken);

        return response;
    }

    private static IQueryable<Domain.ProjectTask> ApplySort(
        IQueryable<Domain.ProjectTask> query,
        string? sortColumn,
        string? sortDirection)
    {
        var column = string.IsNullOrWhiteSpace(sortColumn) ? "CreatedAt" : sortColumn;
        var descending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        return column switch
        {
            "Title" => descending ? query.OrderByDescending(t => t.Title) : query.OrderBy(t => t.Title),
            "ProjectId" => descending ? query.OrderByDescending(t => t.ProjectId) : query.OrderBy(t => t.ProjectId),
            "Status" => descending ? query.OrderByDescending(t => t.Status) : query.OrderBy(t => t.Status),
            "Priority" => descending ? query.OrderByDescending(t => t.Priority) : query.OrderBy(t => t.Priority),
            "DueDate" => descending ? query.OrderByDescending(t => t.DueDate) : query.OrderBy(t => t.DueDate),
            _ => descending ? query.OrderByDescending(t => t.CreatedAt) : query.OrderBy(t => t.CreatedAt),
        };
    }
}
