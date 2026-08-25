namespace Application.Features.Task.Create;

public sealed record Response(
    int Id,
    string Title,
    string Status,
    string Priority,
    DateOnly? DueDate,
    int ProjectId);
