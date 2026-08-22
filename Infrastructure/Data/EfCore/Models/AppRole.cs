using Infrastructure.Data.EfCore.Extensions;
using Microsoft.AspNetCore.Identity;

namespace Infrastructure.Data.EfCore.Models;

public class AppRole : IdentityRole<int>, IAuditable
{
    public string? Description { get; set; }
    public AppRole() : base() { }
    public AppRole(string roleName) : base(roleName) { }
    public AppRole(string roleName, string description) : base(roleName)
    {
        Description = description;
    }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public int? UpdatedBy { get; set; }
}
