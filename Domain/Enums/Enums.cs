namespace Domain.Enums;

public enum MenuType
{
    TopBar = 1,
    SideBar = 2
}

public enum ProjectTaskStatus
{
    Todo = 0,
    InProgress = 1,
    Completed = 2,
    Cancelled = 3
}

public enum TaskPriority
{
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3
}

public enum ProjectRole
{
    Owner = 0,
    Manager = 1,
    Member = 2,
    Viewer = 3
}
