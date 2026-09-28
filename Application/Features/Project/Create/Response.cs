namespace Application.Features.Project.Create;

/// <summary>Result returned by the project create use case.</summary>
public sealed record Response(int Id, string Name, string? Description, DateOnly? StartDate, DateOnly? EndDate);
