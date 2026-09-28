using MediatR;

namespace Application.Features.Task.Create;

/// <summary>Input for the task create command.</summary>
public sealed record Command(
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    /// <summary>The task execution state.</summary>
    string? Status,
    /// <summary>The task urgency.</summary>
    string? Priority,
    DateOnly? DueDate,
    /// <summary>Assignee email for this task create contract.</summary>
    string? AssigneeEmail) : IRequest<Response>;
