namespace Application.Features.Task.List;

public sealed record Response(
    int Page,
    int PageSize,
    int TotalCount,
    int FilteredCount,
    int TotalPages,
    IReadOnlyList<Item> Items);

public sealed record Item(
    int Id,
    int ProjectId,
    string ProjectName,
    string Title,
    string? Description,
    string Status,
    string Priority,
    string? DueDate,
    DateTime CreatedAt,
    bool CanEdit,
    bool CanDelete);
