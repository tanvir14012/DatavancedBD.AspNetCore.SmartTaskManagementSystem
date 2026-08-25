using MediatR;

namespace Application.Features.Task.Board;

public sealed record Query(
    int? ProjectId = null,
    string? Search = null,
    string? Priority = null) : IRequest<Response>;
