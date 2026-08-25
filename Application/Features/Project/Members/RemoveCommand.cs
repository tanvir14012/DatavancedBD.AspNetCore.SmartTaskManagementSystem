using MediatR;

namespace Application.Features.Project.Members;

public sealed record RemoveCommand(int ProjectId, int UserId) : IRequest<bool>;
