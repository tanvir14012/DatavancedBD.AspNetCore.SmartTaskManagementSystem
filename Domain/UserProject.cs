using Domain.Enums;

namespace Domain;

public sealed class UserProject
{
    public int UserId { get; set; } = default!;
    public AppUser User { get; set; } = default!;

    public int ProjectId { get; set; }
    public Project Project { get; set; } = default!;

    public ProjectRole ProjectRole { get; set; } = ProjectRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
