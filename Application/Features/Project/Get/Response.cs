namespace Application.Features.Project.Get;

public sealed record Response(int Id, string Name, string? Description, DateOnly? StartDate,
    DateOnly? EndDate, DateTime CreatedAt);
