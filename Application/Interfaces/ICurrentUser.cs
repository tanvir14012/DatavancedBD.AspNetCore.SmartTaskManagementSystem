namespace Application.Interfaces
{
    /// <summary>The authenticated identity and roles available to the current request.</summary>
    public interface ICurrentUser
    {
        /// <summary>Whether an authenticated identity is available.</summary>
        bool IsAuthenticated { get; }

        /// <summary>The user identifier within the current storage boundary.</summary>
        int? UserId { get; }

        /// <summary>The authenticated user's name, when available.</summary>
        string? UserName { get; }

        /// <summary>The user's email address.</summary>
        string? Email { get; }

        /// <summary>The application's roles associated with the user.</summary>
        IReadOnlyCollection<string> Roles { get; }

        /// <summary>Checks whether the current identity has the specified role.</summary>
        bool IsInRole(string role);
    }
}
