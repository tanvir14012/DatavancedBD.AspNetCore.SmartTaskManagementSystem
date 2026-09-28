namespace Application.Features.MenuItem.List;

/// <summary>Result returned by the menuitem list use case.</summary>
public sealed record Response(IReadOnlyList<MenuItemNode> Menus);

/// <summary>Menu item node contract for menuitem list.</summary>
public sealed record MenuItemNode(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The display name.</summary>
    string Name,
    /// <summary>Route for this menuitem list contract.</summary>
    string Route,
    /// <summary>Icon for this menuitem list contract.</summary>
    string Icon,
    /// <summary>Display order for this menuitem list contract.</summary>
    int DisplayOrder,
    /// <summary>Parent id for this menuitem list contract.</summary>
    int? ParentId,
    /// <summary>Type for this menuitem list contract.</summary>
    string Type,
    /// <summary>Children for this menuitem list contract.</summary>
    IReadOnlyList<MenuItemNode> Children);
