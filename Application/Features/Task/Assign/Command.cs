using MediatR;

namespace Application.Features.Task.Assign;

public sealed record Command(
    int TaskId,
    string? UserId = null,
    string? Email = null) : IRequest<Response>;
