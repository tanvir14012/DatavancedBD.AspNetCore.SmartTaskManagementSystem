namespace Application.Features.Task.Delete;

/// <summary>Result returned by the task delete use case.</summary>
public sealed record Response(bool Success, int Id);
