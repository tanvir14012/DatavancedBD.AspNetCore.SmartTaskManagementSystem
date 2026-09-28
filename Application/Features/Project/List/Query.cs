using MediatR;

namespace Application.Features.Project.List;

/// <summary>Input for the project list query.</summary>
public sealed record Query(
    /// <summary>The optional search term.</summary>
    string? Search = null,
    /// <summary>The requested sort field.</summary>
    string? SortColumn = null,
    /// <summary>The requested ascending or descending ordering.</summary>
    string? SortDirection = null,
    /// <summary>The zero-based first result offset.</summary>
    int Start = 0,
    /// <summary>The maximum number of results requested.</summary>
    int Length = 20,
    /// <summary>The task execution state.</summary>
    string? Status = null) : IRequest<Response>;
