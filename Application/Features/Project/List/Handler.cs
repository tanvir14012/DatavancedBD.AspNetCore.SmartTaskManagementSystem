using Application.Interfaces;
using Application.Models;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Project.List;

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
        var cacheKey = $"projects:list:{userId}:{request.Status ?? "all"}:{request.Search ?? string.Empty}:{request.SortColumn ?? "CreatedAt"}:{request.SortDirection ?? "desc"}:{request.Start}:{request.Length}";

        var cachedResponse = await cacheService.GetAsync<Response>(cacheKey, cancellationToken);
        if (cachedResponse is not null)
        {
            return cachedResponse;
        }

        var query = dbContext.Projects
            .AsNoTracking()
            .Include(p => p.Members)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            query = query.Where(p => p.Members.Any(m => m.UserId == userId));
        }

        var normalizedStatus = NormalizeProjectStatus(request.Status);
        if (!string.IsNullOrWhiteSpace(normalizedStatus))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            switch (normalizedStatus)
            {
                case "active":
                    query = query.Where(p => !p.IsArchived);
                    break;
                case "archived":
                    query = query.Where(p => p.IsArchived);
                    break;
                case "planned":
                    query = query.Where(p => !p.IsArchived && (!p.StartDate.HasValue || p.StartDate.Value > today));
                    break;
                case "completed":
                    query = query.Where(p => !p.IsArchived && p.EndDate.HasValue && p.EndDate.Value <= today);
                    break;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(p =>
                EF.Functions.Like(p.Name, $"%{search}%") ||
                (p.Description != null && EF.Functions.Like(p.Description, $"%{search}%")));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var pageSize = Math.Max(request.Length, 1);
        var start = Math.Max(request.Start, 0);

        query = ApplySort(query, request.SortColumn, request.SortDirection);

        var pageItems = await query
            .Skip(start)
            .Take(pageSize)
            .Select(p => new
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                StartDate = p.StartDate,
                EndDate = p.EndDate,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                CanEdit = currentUser.IsInRole("Admin") || p.Members.Any(m => m.UserId == userId && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner)),
                CanDelete = currentUser.IsInRole("Admin"),
                IsArchived = p.IsArchived,
                CurrentUserRole = p.Members.Where(m => m.UserId == userId).Select(m => m.ProjectRole).FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var projectIds = pageItems.Select(item => item.Id).Distinct().ToList();
        var taskCountsByProjectId = await dbContext.ProjectTasks
            .AsNoTracking()
            .Where(task => projectIds.Contains(task.ProjectId) && !task.IsDeleted)
            .GroupBy(task => task.ProjectId)
            .Select(group => new { ProjectId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(pair => pair.ProjectId, pair => pair.Count, cancellationToken);

        var items = pageItems
            .Select(item => new Item(
                item.Id,
                item.Name,
                item.Description,
                item.StartDate,
                item.EndDate,
                item.CreatedAt,
                item.UpdatedAt,
                item.CanEdit,
                item.CanDelete,
                item.IsArchived ? "Archived" : "Active",
                item.CurrentUserRole.ToString(),
                taskCountsByProjectId.TryGetValue(item.Id, out var count) ? count : 0,
                item.CurrentUserRole))
            .ToList();

        var response = new Response(
            (start / pageSize) + 1,
            pageSize,
            totalCount,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)pageSize),
            items);

        await cacheService.SetAsync(
            cacheKey,
            response,
            new CacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(3) },
            cancellationToken);

        return response;
    }

    private static IQueryable<Domain.Project> ApplySort(
        IQueryable<Domain.Project> query,
        string? sortColumn,
        string? sortDirection)
    {
        var column = string.IsNullOrWhiteSpace(sortColumn) ? "CreatedAt" : NormalizeSortColumn(sortColumn, "CreatedAt");
        var descending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        return column switch
        {
            "Name" => descending ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
            "StartDate" => descending ? query.OrderByDescending(p => p.StartDate) : query.OrderBy(p => p.StartDate),
            "EndDate" => descending ? query.OrderByDescending(p => p.EndDate) : query.OrderBy(p => p.EndDate),
            "UpdatedAt" => descending ? query.OrderByDescending(p => p.UpdatedAt) : query.OrderBy(p => p.UpdatedAt),
            _ => descending ? query.OrderByDescending(p => p.CreatedAt) : query.OrderBy(p => p.CreatedAt),
        };
    }

    private static string NormalizeSortColumn(string? value, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        return value.Trim() switch
        {
            "name" => "Name",
            "createdat" => "CreatedAt",
            "updatedat" => "UpdatedAt",
            "startdate" => "StartDate",
            "enddate" => "EndDate",
            _ => value.Trim()
        };
    }

    private static string? NormalizeProjectStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) || string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "active" => "active",
            "archived" => "archived",
            "planned" => "planned",
            "completed" => "completed",
            _ => status.Trim()
        };
    }
}
