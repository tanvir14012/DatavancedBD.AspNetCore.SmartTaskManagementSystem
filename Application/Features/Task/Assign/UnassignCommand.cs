using MediatR;

namespace Application.Features.Task.Assign;

public sealed record UnassignCommand(int TaskId, string UserId) : IRequest<Response>;
