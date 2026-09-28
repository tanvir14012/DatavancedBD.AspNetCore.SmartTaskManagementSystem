using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Domain;

/// <summary>An application user and their project, task, and refresh-token associations.</summary>
public sealed class AppUser : IdentityUser<int>, IAuditable
{
    /// <summary>The user's given name.</summary>
    public string FirstName { get; set; } = string.Empty;
    /// <summary>The user's family name.</summary>
    public string LastName { get; set; } = string.Empty;
    /// <summary>The optional profile image URL.</summary>
    public string? ImageUrl { get; set; }

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
    /// <summary>Refresh credentials issued to the user.</summary>
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    /// <summary>Project memberships belonging to the user.</summary>
    public ICollection<UserProject> Projects { get; set; } = [];
    /// <summary>Task assignments belonging to the user.</summary>
    public ICollection<UserTask> Tasks { get; set; } = [];
}
