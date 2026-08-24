namespace Application.Features.MenuItem.List;

public sealed record Response(
    IReadOnlyList<MenuItemNode> TopBar,
    IReadOnlyList<MenuItemNode> SideBar);

public sealed record MenuItemNode(
    int Id,
    string Name,
    string Route,
    string Icon,
    int DisplayOrder,
    int? ParentId,
    string Type,
    IReadOnlyList<MenuItemNode> Children);
