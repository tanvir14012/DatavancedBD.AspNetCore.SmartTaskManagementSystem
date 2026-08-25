using MediatR;

namespace Application.Features.Project.Members;

public sealed record AssignCommand(int ProjectId, int UserId, string Role) : IRequest<AssignResult>;
