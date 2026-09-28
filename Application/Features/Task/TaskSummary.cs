using Domain.Enums;

namespace Application.Features.Task;

/// <summary>Task summary contract for task.</summary>
public sealed record TaskSummary(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    ProjectTaskStatus Status,
    /// <summary>The task urgency.</summary>
    TaskPriority Priority,
    DateOnly? DueDate,
    /// <summary>The UTC creation instant.</summary>
    DateTime CreatedAt);
