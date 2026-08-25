using MediatR;

namespace Application.Features.Project.Delete;

public sealed record Command(int Id) : IRequest<Response>;
