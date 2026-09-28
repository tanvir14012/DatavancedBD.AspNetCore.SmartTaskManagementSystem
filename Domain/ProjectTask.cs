using Domain.Enums;
using Domain.Interfaces;

namespace Domain;

/// <summary>A unit of work assigned to a project.</summary>
public sealed class ProjectTask : AuditableEntity, ISoftDeletable
{
    /// <summary>The task's display title.</summary>
    public string Title { get; set; } = default!;
    /// <summary>The optional descriptive text.</summary>
    public string? Description { get; set; }

    /// <summary>The current task execution state.</summary>
    public ProjectTaskStatus Status { get; set; } = ProjectTaskStatus.Todo;
    /// <summary>The task's urgency.</summary>
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    /// <summary>The optional calendar date by which the task is due.</summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>The owning project's identifier.</summary>
    public int ProjectId { get; set; }
    private Project? project;

    /// <summary>The owning project; access requires the navigation to have been loaded.</summary>
    public Project Project
    {
        get => project ?? throw new InvalidOperationException("The task's project has not been loaded.");
        set => project = value;
    }

    /// <summary>The user who created this record.</summary>
    public AppUser CreatedBy { get; set; } = default!;

    /// <summary>Whether the record has been soft-deleted.</summary>
    public bool IsDeleted {  get; set; }

    /// <summary>Users assigned to this task.</summary>
    public ICollection<UserTask> Assignees { get; set; } = [];
}
