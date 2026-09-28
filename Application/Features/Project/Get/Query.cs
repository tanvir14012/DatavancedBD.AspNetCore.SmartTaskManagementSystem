using MediatR;

namespace Application.Features.Project.Get;

/// <summary>Input for the project get query.</summary>
public sealed record Query(int Id) : IRequest<Response>;
