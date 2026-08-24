namespace Application.Features.Dashboard;

public sealed record DashboardSummary(
    int TotalProjects,
    int TotalTasks,
    int CompletedTasks,
    int PendingTasks,
    IReadOnlyList<KeyValuePair<string, int>> StatusBreakdown,
    IReadOnlyList<KeyValuePair<string, int>> PriorityBreakdown,
    IReadOnlyList<DashboardUrgentTask> UrgentTasks);

public sealed record DashboardUrgentTask(
    int Id,
    string Title,
    string Status,
    string Priority,
    DateOnly? DueDate,
    int ProjectId);
