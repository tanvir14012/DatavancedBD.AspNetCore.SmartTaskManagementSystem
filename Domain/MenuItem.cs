using Domain.Enums;

namespace Domain
{
    /// <summary>A navigable menu entry within a top-bar or side-bar hierarchy.</summary>
    public sealed class MenuItem : AuditableEntity
    {
        /// <summary>The display name.</summary>
        public required string Name { get; set; }
        /// <summary>The client navigation route.</summary>
        public required string Route { get; set; }
        /// <summary>The client icon identifier.</summary>
        public required string Icon { get; set; }
        /// <summary>The ordering position among sibling menu entries.</summary>
        public int DisplayOrder { get; set; }
        /// <summary>The navigation region for this entry.</summary>
        public MenuType Type { get; set; }

        // Self-referential hierarchy handles BOTH:
        // 1. TopBar -> Top-Level SideBar items
        // 2. SideBar -> Nested Sub-SideBar items
        /// <summary>The parent entry identifier, or null for a root entry.</summary>
        public int? ParentId { get; set; }
        /// <summary>The parent entry when loaded.</summary>
        public MenuItem? Parent { get; set; }
        /// <summary>Child entries belonging to this menu entry.</summary>
        public ICollection<MenuItem> Children { get; set; } = [];

    }
}
