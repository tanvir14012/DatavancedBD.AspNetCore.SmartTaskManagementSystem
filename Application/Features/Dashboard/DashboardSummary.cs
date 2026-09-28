namespace Application.Features.Dashboard;

/// <summary>Dashboard summary contract for dashboard.</summary>
public sealed record DashboardSummary(
    /// <summary>Total projects for this dashboard contract.</summary>
    int TotalProjects,
    /// <summary>Total tasks for this dashboard contract.</summary>
    int TotalTasks,
    /// <summary>Completed tasks for this dashboard contract.</summary>
    int CompletedTasks,
    /// <summary>Pending tasks for this dashboard contract.</summary>
    int PendingTasks,
    /// <summary>Status breakdown for this dashboard contract.</summary>
    IReadOnlyList<KeyValuePair<string, int>> StatusBreakdown,
    /// <summary>Priority breakdown for this dashboard contract.</summary>
    IReadOnlyList<KeyValuePair<string, int>> PriorityBreakdown,
    /// <summary>Urgent tasks for this dashboard contract.</summary>
    IReadOnlyList<DashboardUrgentTask> UrgentTasks);

/// <summary>Dashboard urgent task contract for dashboard.</summary>
public sealed record DashboardUrgentTask(
    /// <summary>The identifier of the returned resource.</summary>
    int Id,
    /// <summary>The task title.</summary>
    string Title,
    /// <summary>The task execution state.</summary>
    string Status,
    /// <summary>The task urgency.</summary>
    string Priority,
    DateOnly? DueDate,
    /// <summary>The project identifier within the current storage boundary.</summary>
    int ProjectId);
