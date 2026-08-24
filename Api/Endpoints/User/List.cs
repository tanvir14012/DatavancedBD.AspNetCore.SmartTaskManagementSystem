using Domain;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.User;

public sealed class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Users");

        group.MapGet("/", GetUsers)
            .WithName("GetUsers")
            .WithSummary("List users with search, sort, filter and pagination")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "Project Manager", "Team Member"));
    }

    private static async Task<IResult> GetUsers(
        AppDbContext dbContext,
        [FromQuery] string? search = null,
        [FromQuery] string? sortColumn = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int start = 0,
        [FromQuery] int length = 20,
        [FromQuery] string? role = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<AppUser> query = dbContext.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(role) && !string.Equals(role, "all", StringComparison.OrdinalIgnoreCase))
        {
            var roleName = role.Trim();
            query = query.Where(user =>
                dbContext.UserRoles.Any(userRole => userRole.UserId == user.Id &&
                    dbContext.Roles.Any(roleEntity => roleEntity.Id == userRole.RoleId && roleEntity.Name == roleName)));
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var isActive = string.Equals(status, "active", StringComparison.OrdinalIgnoreCase);
            var utcNow = DateTimeOffset.UtcNow;
            query = isActive
                ? query.Where(user => user.LockoutEnd == null || user.LockoutEnd <= utcNow)
                : query.Where(user => user.LockoutEnd != null && user.LockoutEnd > utcNow);
        }

        var request = new DataTableRequest
        {
            Start = start,
            Length = length,
            Search = search,
            SortColumn = string.IsNullOrWhiteSpace(sortColumn) ? "CreatedAt" : sortColumn,
            SortDirection = string.IsNullOrWhiteSpace(sortDirection) ? "desc" : sortDirection,
        };

        var configuration = new DataTableQueryConfiguration { MaxPageSize = 200 };
        configuration.SearchableColumns.Add("FirstName");
        configuration.SearchableColumns.Add("LastName");
        configuration.SearchableColumns.Add("Email");
        configuration.SearchableColumns.Add("UserName");
        configuration.SortableColumns.Add("FirstName");
        configuration.SortableColumns.Add("LastName");
        configuration.SortableColumns.Add("Email");
        configuration.SortableColumns.Add("CreatedAt");

        var page = await query.ToDataTablePageAsync(
            dbContext,
            request,
            user => new UserListProjection(
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email ?? string.Empty,
                user.UserName ?? user.Email ?? string.Empty,
                user.CreatedAt,
                user.LockoutEnd),
            configuration,
            cancellationToken);

        var userIds = page.Items.Select(item => item.Id).Distinct().ToList();
        var rolesByUserId = await dbContext.UserRoles
            .AsNoTracking()
            .Where(userRole => userIds.Contains(userRole.UserId))
            .Join(dbContext.Roles.AsNoTracking(), userRole => userRole.RoleId, role => role.Id, (userRole, role) => new { userRole.UserId, Role = role.Name ?? "Team Member" })
            .GroupBy(pair => pair.UserId)
            .Select(group => new { UserId = group.Key, Role = group.Select(pair => pair.Role).FirstOrDefault() ?? "Team Member" })
            .ToDictionaryAsync(pair => pair.UserId, pair => pair.Role, cancellationToken);

        var items = page.Items.Select(item => new UserListItem(
            item.Id,
            item.FirstName,
            item.LastName,
            item.Email,
            rolesByUserId.TryGetValue(item.Id, out var roleName) ? roleName : "Team Member",
            item.LockoutEnd is null || item.LockoutEnd <= DateTimeOffset.UtcNow,
            item.CreatedAt)).ToList();

        return Results.Ok(new
        {
            page = (start / Math.Max(length, 1)) + 1,
            pageSize = length,
            totalCount = page.TotalCount,
            filteredCount = page.FilteredCount,
            totalPages = (int)Math.Ceiling(page.FilteredCount / (double)Math.Max(length, 1)),
            items
        });
    }
}

public sealed record UserListProjection(
    int Id,
    string FirstName,
    string LastName,
    string Email,
    string UserName,
    DateTime CreatedAt,
    DateTimeOffset? LockoutEnd);

public sealed record UserListItem(
    int Id,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    bool IsActive,
    DateTime CreatedAt);
