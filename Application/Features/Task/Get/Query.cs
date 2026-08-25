using MediatR;

namespace Application.Features.Task.Get;

public sealed record Query(int Id) : IRequest<Response>;
