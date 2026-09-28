namespace Domain.Enums;

/// <summary>The navigation region containing a menu item.</summary>
public enum MenuType
{
    /// <summary>An entry in the top navigation bar.</summary>
    TopBar = 1,
    /// <summary>An entry in the side navigation hierarchy.</summary>
    SideBar = 2
}

/// <summary>The current stage of task execution.</summary>
public enum ProjectTaskStatus
{
    /// <summary>Work has not yet started.</summary>
    Todo = 0,
    /// <summary>Work is currently underway.</summary>
    InProgress = 1,
    /// <summary>Work has finished.</summary>
    Completed = 2,
    /// <summary>Work was cancelled.</summary>
    Cancelled = 3
}

/// <summary>The relative urgency of a task.</summary>
public enum TaskPriority
{
    /// <summary>Low urgency.</summary>
    Low = 0,
    /// <summary>Normal urgency.</summary>
    Medium = 1,
    /// <summary>High urgency.</summary>
    High = 2,
    /// <summary>Critical urgency.</summary>
    Critical = 3
}

/// <summary>The access role assigned within a project.</summary>
public enum ProjectRole
{
    /// <summary>The project owner.</summary>
    Owner = 0,
    /// <summary>A user managing the project.</summary>
    Manager = 1,
    /// <summary>A participating project member.</summary>
    Member = 2,
    /// <summary>A user with viewing access.</summary>
    Viewer = 3
}
