namespace Application.Features.Task.Create;

/// <summary>Result returned by the task create use case.</summary>
public sealed record Response(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The task execution state.</summary>
    string Status,
    /// <summary>The task urgency.</summary>
    string Priority,
    DateOnly? DueDate,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId);
