namespace Application.Features.Task.Update;

public sealed record Response(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    string Status,
    string Priority,
    DateOnly? DueDate,
    DateTime CreatedAt,
    bool CanEdit,
    bool CanDelete);
