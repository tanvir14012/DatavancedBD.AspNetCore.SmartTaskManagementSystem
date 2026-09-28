using MediatR;

namespace Application.Features.Task.List;

/// <summary>Input for the task list query.</summary>
public sealed record Query(
    /// <summary>The zero-based first result offset.</summary>
    int Start = 0,
    /// <summary>The maximum number of results requested.</summary>
    int Length = 20,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int? ProjectId = null,
    /// <summary>The task execution state.</summary>
    string? Status = null,
    /// <summary>The task urgency.</summary>
    string? Priority = null,
    /// <summary>Assignee id for this task list contract.</summary>
    string? AssigneeId = null,
    /// <summary>The optional search term.</summary>
    string? Search = null,
    /// <summary>The requested sort field.</summary>
    string? SortColumn = null,
    /// <summary>The requested ascending or descending ordering.</summary>
    string? SortDirection = null) : IRequest<Response>;
