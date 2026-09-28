using MediatR;

namespace Application.Features.Project.Update;

/// <summary>Input for the project update command.</summary>
public sealed record Command(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The display name.</summary>
    string Name,
    /// <summary>The optional descriptive text.</summary>
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    /// <summary>Is archived for this project update contract.</summary>
    bool IsArchived) : IRequest<Response>;
