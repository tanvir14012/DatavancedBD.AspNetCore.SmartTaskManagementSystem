namespace Application.Features.Project.Get;

/// <summary>Result returned by the project get use case.</summary>
public sealed record Response(int Id, string Name, string? Description, DateOnly? StartDate,
    DateOnly? EndDate, DateTime CreatedAt);
