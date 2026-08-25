using MediatR;
using Application.Features.Dashboard;

namespace Application.Features.Dashboard.Summary;

public sealed record Query(int? ProjectId = null) : IRequest<DashboardSummary>;
