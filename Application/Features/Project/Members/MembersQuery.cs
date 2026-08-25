using MediatR;

namespace Application.Features.Project.Members;

public sealed record MembersQuery(int ProjectId) : IRequest<IReadOnlyList<ProjectMemberSummary>>;
