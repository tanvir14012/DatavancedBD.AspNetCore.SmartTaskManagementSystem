using Application.Interfaces;
using Application.Models;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.MenuItem.List;

public sealed class Handler(IAppDbContext dbContext, ICacheService cacheService)
    : IRequestHandler<Query, Response>
{
    public async Task<Response> Handle(Query request, CancellationToken cancellationToken)
    {
        const string cacheKey = "menu-items:tree:v1";

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

        var response = new Response(BuildTree(menuItems, MenuType.TopBar));

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
