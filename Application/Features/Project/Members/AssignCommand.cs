using MediatR;

namespace Application.Features.Project.Members;

/// <summary>Assign command contract for project members.</summary>
public sealed record AssignCommand(int ProjectId, int UserId, string Role) : IRequest<AssignResult>;
