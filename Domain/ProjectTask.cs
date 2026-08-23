using Domain.Enums;
using Domain.Interfaces;

namespace Domain;

public sealed class ProjectTask : AuditableEntity, ISoftDeletable
{
    public string Title { get; set; } = default!;
    public string? Description { get; set; }

    public ProjectTaskStatus Status { get; set; } = ProjectTaskStatus.Todo;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public DateOnly? DueDate { get; set; }

    public int ProjectId { get; set; }
    public Project Project { get; set; }

    public AppUser CreatedBy { get; set; } = default!;

    public bool IsDeleted {  get; set; }

    public ICollection<UserTask> Assignees { get; set; } = [];
}
