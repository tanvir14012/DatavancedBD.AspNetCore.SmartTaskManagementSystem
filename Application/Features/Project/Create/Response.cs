namespace Application.Features.Project.Create;

public sealed record Response(int Id, string Name, string? Description, DateOnly? StartDate, DateOnly? EndDate);
