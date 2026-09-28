using MediatR;

namespace Application.Features.Task.Get;

/// <summary>Input for the task get query.</summary>
public sealed record Query(int Id) : IRequest<Response>;
