namespace Application.Features.Task.List;

/// <summary>Result returned by the task list use case.</summary>
public sealed record Response(
    /// <summary>Page for this task list contract.</summary>
    int Page,
    /// <summary>Page size for this task list contract.</summary>
    int PageSize,
    /// <summary>Total count for this task list contract.</summary>
    int TotalCount,
    /// <summary>Filtered count for this task list contract.</summary>
    int FilteredCount,
    /// <summary>Total pages for this task list contract.</summary>
    int TotalPages,
    /// <summary>Items for this task list contract.</summary>
    IReadOnlyList<Item> Items);

/// <summary>Item contract for task list.</summary>
public sealed record Item(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId,
    /// <summary>Project name for this task list contract.</summary>
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
    /// <summary>The UTC creation instant.</summary>
    DateTime CreatedAt,
    /// <summary>Whether the current user may edit this resource.</summary>
    bool CanEdit,
    /// <summary>Whether the current user may delete this resource.</summary>
    bool CanDelete);
