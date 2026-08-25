using MediatR;

namespace Application.Features.Task.Delete;

public sealed record Command(int Id) : IRequest<Response>;
