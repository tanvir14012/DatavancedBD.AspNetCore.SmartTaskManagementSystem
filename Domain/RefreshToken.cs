namespace Domain;

/// <summary>A hashed refresh credential with expiry and revocation state.</summary>
public sealed class RefreshToken : BaseEntity<int>
{
    /// <summary>The stored hash of the refresh token; the raw credential is not persisted.</summary>
    public string TokenHash { get; set; } = default!;

    /// <summary>The associated user's identifier.</summary>
    public int UserId { get; set; } = default!;
    /// <summary>The associated user when loaded.</summary>
    public AppUser User { get; set; } = default!;

    /// <summary>The UTC instant at which the credential was created.</summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    /// <summary>The UTC instant at which the credential expires.</summary>
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>Whether the credential has been revoked.</summary>
    public bool IsRevoked { get; set; }
    /// <summary>The UTC revocation instant, when revoked.</summary>
    public DateTime? RevokedAtUtc { get; set; }

    /// <summary>Whether the current UTC time has reached the expiry instant.</summary>
    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    /// <summary>Whether the credential is neither revoked nor expired.</summary>
    public bool IsActive => !IsRevoked && !IsExpired;

    /// <summary>Revokes this credential and records the current UTC instant.</summary>
    public void Revoke()
    {
        IsRevoked = true;
        RevokedAtUtc = DateTime.UtcNow;
    }
}
