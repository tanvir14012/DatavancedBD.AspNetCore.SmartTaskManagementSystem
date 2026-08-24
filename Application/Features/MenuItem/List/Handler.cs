using Application.Interfaces;
using Application.Models;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.MenuItem.List;

public sealed class Handler(IAppDbContext dbContext, ICacheService cacheService, ICurrentUser currentUser)
    : IRequestHandler<Query, Response>
{
    public async Task<Response> Handle(Query request, CancellationToken cancellationToken)
    {
        var cacheKey = $"menu-items:tree:{GetRoleScope(currentUser)}";

        var cached = await cacheService.GetAsync<Response>(cacheKey, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var menuItems = await dbContext.MenuItems
            .AsNoTracking()
            .OrderBy(x => x.Type)
            .ThenBy(x => x.DisplayOrder)
            .ToListAsync(cancellationToken);

        var visibleItems = FilterVisibleItems(menuItems);
        var response = new Response(BuildTree(visibleItems, MenuType.TopBar));

        await cacheService.SetAsync(
            cacheKey,
            response,
            new CacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            },
            cancellationToken);

        return response;
    }

    private static string GetRoleScope(ICurrentUser currentUser)
    {
        if (currentUser.IsInRole("Admin"))
        {
            return "admin";
        }

        if (currentUser.IsInRole("Project Manager"))
        {
            return "project-manager";
        }

        return "team-member";
    }

    private IReadOnlyList<Domain.MenuItem> FilterVisibleItems(IReadOnlyCollection<Domain.MenuItem> items)
    {
        var canAccessBoard = currentUser.IsInRole("Admin") || currentUser.IsInRole("Project Manager");
        var canManageProjects = currentUser.IsInRole("Admin") || currentUser.IsInRole("Project Manager");

        return items
            .Where(item =>
            {
                if (item.Route == "/tasks/board" && !canAccessBoard)
                {
                    return false;
                }

                if ((item.Route == "/projects/new" || item.Route == "/projects/assign") && !canManageProjects)
                {
                    return false;
                }

                return true;
            })
            .ToList();
    }

    private static IReadOnlyList<MenuItemNode> BuildTree(IReadOnlyCollection<Domain.MenuItem> items, MenuType type)
    {
        var roots = items
            .Where(x => x.Type == type && !x.ParentId.HasValue)
            .OrderBy(x => x.DisplayOrder)
            .ToList();

        return roots
            .Select(root => MapNode(root, items))
            .ToList();
    }

    private static MenuItemNode MapNode(Domain.MenuItem item, IReadOnlyCollection<Domain.MenuItem> allItems)
    {
        var children = allItems
            .Where(x => x.ParentId == item.Id)
            .OrderBy(x => x.DisplayOrder)
            .Select(child => MapNode(child, allItems))
            .ToList();

        return new MenuItemNode(
            item.Id,
            item.Name,
            item.Route,
            item.Icon,
            item.DisplayOrder,
            item.ParentId,
            item.Type.ToString(),
            children);
    }
}
