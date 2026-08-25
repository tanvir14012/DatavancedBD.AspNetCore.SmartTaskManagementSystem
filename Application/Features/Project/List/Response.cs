namespace Application.Features.Project.List;

public sealed record Response(
    int Page,
    int PageSize,
    int TotalCount,
    int FilteredCount,
    int TotalPages,
    IReadOnlyList<Item> Items);

public sealed record Item(
    int Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    bool CanEdit,
    bool CanDelete,
    string Status,
    string Role,
    int TaskCount,
    Domain.Enums.ProjectRole CurrentUserRole);
