using MediatR;

namespace Application.Features.Task.Board;

/// <summary>Input for the task board query.</summary>
public sealed record Query(
    /// <summary>The project identifier within the current storage boundary.</summary>
    int? ProjectId = null,
    /// <summary>The optional search term.</summary>
    string? Search = null,
    /// <summary>The task urgency.</summary>
    string? Priority = null) : IRequest<Response>;
