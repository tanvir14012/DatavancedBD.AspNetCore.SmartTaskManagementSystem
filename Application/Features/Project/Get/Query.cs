using MediatR;

namespace Application.Features.Project.Get;

public sealed record Query(int Id) : IRequest<Response>;
