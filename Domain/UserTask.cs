namespace Domain;

public sealed class UserTask
{
    public int UserId { get; set; } = default!;
    public AppUser User { get; set; } = default!;

    public int TaskId { get; set; }
    public ProjectTask Task { get; set; } = default!;

    public bool IsPrimary { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public int AssignedById { get; set; } = default!;
    public AppUser AssignedBy { get; set; } = default!;

}
