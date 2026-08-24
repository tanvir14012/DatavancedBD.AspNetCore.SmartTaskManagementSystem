using Domain;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;

public class MenuItemConfig : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.Property(m => m.Name)
               .HasMaxLength(100)
               .IsRequired();

        builder.Property(m => m.Route)
               .HasMaxLength(200)
               .IsRequired();

        builder.Property(m => m.Icon)
               .HasMaxLength(50);

        // Self-referential hierarchy configuration
        builder.HasOne(m => m.Parent)
               .WithMany(m => m.Children)
               .HasForeignKey(m => m.ParentId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasData(GetSeedMenuItems());
    }

    private static List<MenuItem> GetSeedMenuItems()
    {
        return new List<MenuItem>
        {
            // ==========================================
            // TOP BAR ROOT ITEMS (Level 1)
            // ==========================================
            new MenuItem { Id = 1, Name = "Dashboard", Route = "/dashboard", Icon = "dashboard", DisplayOrder = 1, Type = MenuType.TopBar, ParentId = null },
            new MenuItem { Id = 2, Name = "Projects", Route = "/projects", Icon = "folder", DisplayOrder = 2, Type = MenuType.TopBar, ParentId = null },
            new MenuItem { Id = 3, Name = "Tasks", Route = "/tasks", Icon = "assignment", DisplayOrder = 3, Type = MenuType.TopBar, ParentId = null },
            new MenuItem { Id = 4, Name = "Users", Route = "/users", Icon = "people", DisplayOrder = 4, Type = MenuType.TopBar, ParentId = null },

            // ==========================================
            // LEAN SIDEBAR ITEMS (Level 2)
            // ==========================================
            // Dashboard (Single item - no sub-menus)
            new MenuItem { Id = 10, Name = "Overview", Route = "/dashboard", Icon = "analytics", DisplayOrder = 1, Type = MenuType.SideBar, ParentId = 1 },

            // Projects (Essential views only)
            new MenuItem { Id = 20, Name = "All Projects", Route = "/projects/list", Icon = "list_alt", DisplayOrder = 1, Type = MenuType.SideBar, ParentId = 2 },
            new MenuItem { Id = 21, Name = "New Project", Route = "/projects/new", Icon = "create_new_folder", DisplayOrder = 2, Type = MenuType.SideBar, ParentId = 2 },
            new MenuItem { Id = 41, Name = "Assign Member", Route = "/projects/assign", Icon = "people", DisplayOrder = 3, Type = MenuType.SideBar, ParentId = 2 },

            // Tasks (Essential management views + AI feature)
            new MenuItem { Id = 30, Name = "All Tasks", Route = "/tasks/list", Icon = "table_chart", DisplayOrder = 1, Type = MenuType.SideBar, ParentId = 3 },
            new MenuItem { Id = 31, Name = "Task Board", Route = "/tasks/board", Icon = "view_kanban", DisplayOrder = 2, Type = MenuType.SideBar, ParentId = 3 },

            // Users (Admin requirement)
            new MenuItem { Id = 40, Name = "All Users", Route = "/users/list", Icon = "manage_accounts", DisplayOrder = 1, Type = MenuType.SideBar, ParentId = 4 },
        };
    }
}
