using MediatR;

namespace Application.Features.Project.Members;

/// <summary>Assignments query contract for project members.</summary>
public sealed record AssignmentsQuery(
    /// <summary>The zero-based first result offset.</summary>
    int Start = 0,
    /// <summary>The maximum number of results requested.</summary>
    int Length = 10,
    /// <summary>The optional search term.</summary>
    string? Search = null,
    /// <summary>The application role requested for the user.</summary>
    string? Role = null,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int? ProjectId = null) : IRequest<AssignmentsResponse>;
