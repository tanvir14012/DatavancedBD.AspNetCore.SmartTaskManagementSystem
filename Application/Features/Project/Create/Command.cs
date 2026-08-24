using MediatR;

namespace Application.Features.Project.Create;

public sealed record Command(string Name, string? Description, DateOnly? StartDate, DateOnly? EndDate) : IRequest<Response>;
