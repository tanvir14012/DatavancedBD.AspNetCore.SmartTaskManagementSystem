namespace Application.Features.Project.Update;

public sealed record Response(
    int Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime CreatedAt,
    bool CanEdit,
    bool CanDelete,
    IReadOnlyList<ProjectMemberSummary> Members);

public sealed record ProjectMemberSummary(int UserId, string UserName, string Email, Domain.Enums.ProjectRole Role);
