using MediatR;
using Application.Features.Dashboard;

namespace Application.Features.Dashboard.Summary;

/// <summary>Input for the dashboard summary query.</summary>
public sealed record Query(int? ProjectId = null) : IRequest<DashboardSummary>;
