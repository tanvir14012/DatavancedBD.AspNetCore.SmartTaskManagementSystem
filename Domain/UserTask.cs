namespace Domain;

/// <summary>An assignment of a user to a task.</summary>
public sealed class UserTask
{
    /// <summary>The associated user's identifier.</summary>
    public int UserId { get; set; } = default!;
    /// <summary>The associated user when loaded.</summary>
    public AppUser User { get; set; } = default!;

    /// <summary>The assigned task's identifier.</summary>
    public int TaskId { get; set; }
    /// <summary>The assigned task when loaded.</summary>
    public ProjectTask Task { get; set; } = default!;

    /// <summary>Whether this user is the primary assignee.</summary>
    public bool IsPrimary { get; set; }
    /// <summary>The UTC instant when this assignment was created.</summary>
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    /// <summary>The assigning user's identifier.</summary>
    public int AssignedById { get; set; } = default!;
    /// <summary>The user who created the assignment when loaded.</summary>
    public AppUser AssignedBy { get; set; } = default!;

}
