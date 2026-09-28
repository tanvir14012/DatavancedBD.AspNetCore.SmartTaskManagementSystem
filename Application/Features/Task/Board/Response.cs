namespace Application.Features.Task.Board;

/// <summary>Result returned by the task board use case.</summary>
public sealed record Response(
    /// <summary>Total count for this task board contract.</summary>
    int TotalCount,
    /// <summary>Columns for this task board contract.</summary>
    IReadOnlyList<Column> Columns);

/// <summary>Card contract for task board.</summary>
public sealed record Card(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId,
    /// <summary>Project name for this task board contract.</summary>
    string ProjectName,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    /// <summary>The task execution state.</summary>
    string Status,
    /// <summary>The task urgency.</summary>
    string Priority,
    /// <summary>The optional task due date.</summary>
    string? DueDate,
    /// <summary>The display names of assigned users.</summary>
    IReadOnlyList<string> Assignees,
    /// <summary>Whether the current user may edit this resource.</summary>
    bool CanEdit,
    /// <summary>Whether the current user may delete this resource.</summary>
    bool CanDelete);

/// <summary>Column contract for task board.</summary>
public sealed record Column(
    /// <summary>The task execution state.</summary>
    string Status,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>Task count for this task board contract.</summary>
    int TaskCount,
    /// <summary>Tasks for this task board contract.</summary>
    IReadOnlyList<Card> Tasks);
