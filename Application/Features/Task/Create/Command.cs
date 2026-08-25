using MediatR;

namespace Application.Features.Task.Create;

public sealed record Command(
    int ProjectId,
    string Title,
    string? Description,
    string? Status,
    string? Priority,
    DateOnly? DueDate,
    string? AssigneeEmail) : IRequest<Response>;
