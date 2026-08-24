namespace Application.Interfaces
{
    public interface ICurrentUser
    {
        bool IsAuthenticated { get; }

        int? UserId { get; }

        string? UserName { get; }

        string? Email { get; }

        IReadOnlyCollection<string> Roles { get; }

        bool IsInRole(string role);
    }
}
