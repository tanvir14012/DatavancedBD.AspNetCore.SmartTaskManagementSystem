using MediatR;

namespace Application.Features.Task.Update;

public sealed record Command(
    int Id,
    int? ProjectId,
    string Title,
    string? Description,
    string? Status,
    string? Priority,
    DateOnly? DueDate) : IRequest<Response>;
