namespace Application.Features.Task.Update;

/// <summary>Result returned by the task update use case.</summary>
public sealed record Response(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId,
    /// <summary>Project name for this task update contract.</summary>
    string ProjectName,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    /// <summary>The task execution state.</summary>
    string Status,
    /// <summary>The task urgency.</summary>
    string Priority,
    DateOnly? DueDate,
    /// <summary>The UTC creation instant.</summary>
    DateTime CreatedAt,
    /// <summary>Whether the current user may edit this resource.</summary>
    bool CanEdit,
    /// <summary>Whether the current user may delete this resource.</summary>
    bool CanDelete);
