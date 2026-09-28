using Domain.Enums;

namespace Domain;

/// <summary>Membership and project-level role of a user.</summary>
public sealed class UserProject
{
    /// <summary>The associated user's identifier.</summary>
    public int UserId { get; set; } = default!;
    /// <summary>The associated user when loaded.</summary>
    public AppUser User { get; set; } = default!;

    /// <summary>The owning project's identifier.</summary>
    public int ProjectId { get; set; }
    /// <summary>The owning project. Access requires the navigation to have been loaded.</summary>
    public Project Project { get; set; } = default!;

    /// <summary>The access role held by the user in this project.</summary>
    public ProjectRole ProjectRole { get; set; } = ProjectRole.Member;
    /// <summary>The UTC instant when the user joined the project.</summary>
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
