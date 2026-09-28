using MediatR;

namespace Application.Features.Project.Members;

/// <summary>Remove command contract for project members.</summary>
public sealed record RemoveCommand(int ProjectId, int UserId) : IRequest<bool>;
