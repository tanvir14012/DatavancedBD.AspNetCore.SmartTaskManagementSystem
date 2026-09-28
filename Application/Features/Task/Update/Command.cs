using MediatR;

namespace Application.Features.Task.Update;

/// <summary>Input for the task update command.</summary>
public sealed record Command(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int? ProjectId,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    /// <summary>The task execution state.</summary>
    string? Status,
    /// <summary>The task urgency.</summary>
    string? Priority,
    DateOnly? DueDate) : IRequest<Response>;
