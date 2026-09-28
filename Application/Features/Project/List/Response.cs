namespace Application.Features.Project.List;

/// <summary>Result returned by the project list use case.</summary>
public sealed record Response(
    /// <summary>Page for this project list contract.</summary>
    int Page,
    /// <summary>Page size for this project list contract.</summary>
    int PageSize,
    /// <summary>Total count for this project list contract.</summary>
    int TotalCount,
    /// <summary>Filtered count for this project list contract.</summary>
    int FilteredCount,
    /// <summary>Total pages for this project list contract.</summary>
    int TotalPages,
    /// <summary>Items for this project list contract.</summary>
    IReadOnlyList<Item> Items);

/// <summary>Item contract for project list.</summary>
public sealed record Item(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The display name.</summary>
    string Name,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    /// <summary>The UTC creation instant.</summary>
    DateTime CreatedAt,
    /// <summary>Updated at for this project list contract.</summary>
    DateTime? UpdatedAt,
    /// <summary>Whether the current user may edit this resource.</summary>
    bool CanEdit,
    /// <summary>Whether the current user may delete this resource.</summary>
    bool CanDelete,
    /// <summary>The task execution state.</summary>
    string Status,
    /// <summary>The application role requested for the user.</summary>
    string Role,
    /// <summary>Task count for this project list contract.</summary>
    int TaskCount,
    Domain.Enums.ProjectRole CurrentUserRole);
