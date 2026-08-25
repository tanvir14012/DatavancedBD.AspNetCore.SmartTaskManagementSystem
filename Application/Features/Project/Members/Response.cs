using Domain.Enums;

namespace Application.Features.Project.Members;

public sealed record AssignmentsResponse(
    int Page,
    int PageSize,
    int TotalCount,
    int FilteredCount,
    int TotalPages,
    IReadOnlyList<ProjectAssignmentSummary> Items);

public sealed record ProjectAssignmentSummary(
    int ProjectId,
    string ProjectName,
    int UserId,
    string UserName,
    string Email,
    ProjectRole Role);

public sealed record ProjectMemberSummary(
    int UserId,
    string UserName,
    string Email,
    ProjectRole Role);

public sealed record AssignResult(int ProjectId, int UserId, ProjectRole Role);
