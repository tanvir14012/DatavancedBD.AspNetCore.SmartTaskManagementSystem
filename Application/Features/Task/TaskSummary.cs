using Domain.Enums;

namespace Application.Features.Task;

public sealed record TaskSummary(
    int Id,
    int ProjectId,
    string Title,
    string? Description,
    ProjectTaskStatus Status,
    TaskPriority Priority,
    DateOnly? DueDate,
    DateTime CreatedAt);
