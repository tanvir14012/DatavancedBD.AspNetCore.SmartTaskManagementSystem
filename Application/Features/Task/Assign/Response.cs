namespace Application.Features.Task.Assign;

/// <summary>Result returned by the task assign use case.</summary>
public sealed record Response(string Message, int UserId, int TaskId);
