namespace Application.Features.Project.Delete;

/// <summary>Result returned by the project delete use case.</summary>
public sealed record Response(bool Success, int Id);
