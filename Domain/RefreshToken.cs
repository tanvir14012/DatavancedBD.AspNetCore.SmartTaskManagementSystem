namespace Domain;

public sealed class RefreshToken : BaseEntity<int>
{
    public string TokenHash { get; set; } = default!;

    public int UserId { get; set; } = default!;
    public AppUser User { get; set; } = default!;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }

    public bool IsRevoked { get; set; }
    public DateTime? RevokedAtUtc { get; set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    public bool IsActive => !IsRevoked && !IsExpired;

    public void Revoke()
    {
        IsRevoked = true;
        RevokedAtUtc = DateTime.UtcNow;
    }
}
