using MediatR;

namespace Application.Features.Project.Members;

public sealed record AssignmentsQuery(
    int Start = 0,
    int Length = 10,
    string? Search = null,
    string? Role = null,
    int? ProjectId = null) : IRequest<AssignmentsResponse>;
