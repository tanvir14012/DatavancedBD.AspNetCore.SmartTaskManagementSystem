using Domain.Enums;

namespace Domain
{
    public sealed class MenuItem : AuditableEntity
    {
        public string Name { get; set; }
        public string Route { get; set; }
        public string Icon { get; set; }
        public int DisplayOrder { get; set; }
        public MenuType Type { get; set; }

        // Self-referential hierarchy handles BOTH:
        // 1. TopBar -> Top-Level SideBar items
        // 2. SideBar -> Nested Sub-SideBar items
        public int? ParentId { get; set; }
        public MenuItem? Parent { get; set; }
        public ICollection<MenuItem> Children { get; set; } = [];

    }
}
