using MediatR;

namespace Application.Features.Project.List;

public sealed record Query(
    string? Search = null,
    string? SortColumn = null,
    string? SortDirection = null,
    int Start = 0,
    int Length = 20,
    string? Status = null) : IRequest<Response>;
