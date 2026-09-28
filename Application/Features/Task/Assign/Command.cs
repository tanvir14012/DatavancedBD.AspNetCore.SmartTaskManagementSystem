using MediatR;

namespace Application.Features.Task.Assign;

/// <summary>Input for the task assign command.</summary>
public sealed record Command(
    /// <summary>The task identifier within the current storage boundary.</summary>
    int TaskId,
    /// <summary>The user identifier within the current storage boundary.</summary>
    string? UserId = null,
    /// <summary>The user's email address.</summary>
    string? Email = null) : IRequest<Response>;
