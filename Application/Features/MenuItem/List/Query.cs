using MediatR;

namespace Application.Features.MenuItem.List;

public sealed record Query : IRequest<Response>;
