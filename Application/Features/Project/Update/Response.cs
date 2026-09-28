namespace Application.Features.Project.Update;

/// <summary>Result returned by the project update use case.</summary>
public sealed record Response(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The display name.</summary>
    string Name,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    /// <summary>The UTC creation instant.</summary>
    DateTime CreatedAt,
    /// <summary>Whether the current user may edit this resource.</summary>
    bool CanEdit,
    /// <summary>Whether the current user may delete this resource.</summary>
    bool CanDelete,
    /// <summary>Members for this project update contract.</summary>
    IReadOnlyList<ProjectMemberSummary> Members);

/// <summary>Project member summary contract for project update.</summary>
public sealed record ProjectMemberSummary(int UserId, string UserName, string Email, Domain.Enums.ProjectRole Role);
