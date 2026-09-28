using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Domain;

/// <summary>An application role with provisioning audit metadata.</summary>
public sealed class AppRole : IdentityRole<int>, IAuditable
{
    /// <summary>The optional descriptive text.</summary>
    public string? Description { get; set; }
    /// <summary>Creates a role for persistence materialization.</summary>
    public AppRole() : base() { }
    /// <summary>Creates a role with the supplied identity name.</summary>
    public AppRole(string roleName) : base(roleName) { }
    /// <summary>Creates a named role with a description.</summary>
    public AppRole(string roleName, string description) : base(roleName)
    {
        Description = description;
    }

    /// <summary>The UTC instant at which the record was created.</summary>
    public DateTime CreatedAt { get; set; }
    /// <summary>The UTC instant of the last update, when recorded.</summary>
    public DateTime? UpdatedAt { get; set; }
    /// <summary>The creating user's identifier, when known.</summary>
    public int? CreatedById { get; set; }
    /// <summary>The last updating user's identifier, when known.</summary>
    public int? UpdatedById { get; set; }

    /// <summary>The user who created this record.</summary>
    public AppUser? CreatedBy { get; set; } = default!;
}
