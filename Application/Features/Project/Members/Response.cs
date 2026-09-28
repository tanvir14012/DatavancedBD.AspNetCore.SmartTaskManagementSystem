using Domain.Enums;

namespace Application.Features.Project.Members;

/// <summary>Assignments response contract for project members.</summary>
public sealed record AssignmentsResponse(
    /// <summary>Page for this project members contract.</summary>
    int Page,
    /// <summary>Page size for this project members contract.</summary>
    int PageSize,
    /// <summary>Total count for this project members contract.</summary>
    int TotalCount,
    /// <summary>Filtered count for this project members contract.</summary>
    int FilteredCount,
    /// <summary>Total pages for this project members contract.</summary>
    int TotalPages,
    /// <summary>Items for this project members contract.</summary>
    IReadOnlyList<ProjectAssignmentSummary> Items);

/// <summary>Project assignment summary contract for project members.</summary>
public sealed record ProjectAssignmentSummary(
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId,
    /// <summary>Project name for this project members contract.</summary>
    string ProjectName,
    /// <summary>The user identifier within the current storage boundary.</summary>
    int UserId,
    /// <summary>The authenticated user's name, when available.</summary>
    string UserName,
    /// <summary>The user's email address.</summary>
    string Email,
    ProjectRole Role);

/// <summary>Project member summary contract for project members.</summary>
public sealed record ProjectMemberSummary(
    /// <summary>The user identifier within the current storage boundary.</summary>
    int UserId,
    /// <summary>The authenticated user's name, when available.</summary>
    string UserName,
    /// <summary>The user's email address.</summary>
    string Email,
    ProjectRole Role);

/// <summary>Assign result contract for project members.</summary>
public sealed record AssignResult(int ProjectId, int UserId, ProjectRole Role);
