namespace Application.Features.Task.Board;

public sealed record Response(
    int TotalCount,
    IReadOnlyList<Column> Columns);

public sealed record Card(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    string Status,
    string Priority,
    string? DueDate,
    IReadOnlyList<string> Assignees,
    bool CanEdit,
    bool CanDelete);

public sealed record Column(
    string Status,
    string Title,
    int TaskCount,
    IReadOnlyList<Card> Tasks);
