using MediatR;

namespace Application.Features.Task.List;

public sealed record Query(
    int Start = 0,
    int Length = 20,
    int? ProjectId = null,
    string? Status = null,
    string? Priority = null,
    string? AssigneeId = null,
    string? Search = null,
    string? SortColumn = null,
    string? SortDirection = null) : IRequest<Response>;
