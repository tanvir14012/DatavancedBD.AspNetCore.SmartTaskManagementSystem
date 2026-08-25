using MediatR;

namespace Application.Features.Project.Update;

public sealed record Command(
    int Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsArchived) : IRequest<Response>;
