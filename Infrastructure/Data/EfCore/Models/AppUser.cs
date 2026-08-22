using Infrastructure.Data.EfCore.Extensions;
using Microsoft.AspNetCore.Identity;

namespace Infrastructure.Data.EfCore.Models;

public sealed class AppUser : IdentityUser<int>, IAuditable
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public int? UpdatedBy { get; set; }
}
