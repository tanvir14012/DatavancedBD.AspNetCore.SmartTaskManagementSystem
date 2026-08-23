using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Domain;

public sealed class AppUser : IdentityUser<int>, IAuditable
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedById { get; set; }
    public int? UpdatedById { get; set; }
    public AppUser? CreatedBy { get; set; } = default!;
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<UserProject> Projects { get; set; } = [];
    public ICollection<UserTask> Tasks { get; set; } = [];
}
