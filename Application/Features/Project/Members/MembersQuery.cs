using MediatR;

namespace Application.Features.Project.Members;

/// <summary>Members query contract for project members.</summary>
public sealed record MembersQuery(int ProjectId) : IRequest<IReadOnlyList<ProjectMemberSummary>>;
