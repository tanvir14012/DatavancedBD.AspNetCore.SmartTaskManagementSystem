using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Domain;

public sealed class AppRole : IdentityRole<int>, IAuditable
{
    public string? Description { get; set; }
    public AppRole() : base() { }
    public AppRole(string roleName) : base(roleName) { }
    public AppRole(string roleName, string description) : base(roleName)
    {
        Description = description;
    }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedById { get; set; }
    public int? UpdatedById { get; set; }

    public AppUser? CreatedBy { get; set; } = default!;
}
