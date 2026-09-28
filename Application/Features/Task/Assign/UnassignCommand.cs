using MediatR;

namespace Application.Features.Task.Assign;

/// <summary>Unassign command contract for task assign.</summary>
public sealed record UnassignCommand(int TaskId, string UserId) : IRequest<Response>;
