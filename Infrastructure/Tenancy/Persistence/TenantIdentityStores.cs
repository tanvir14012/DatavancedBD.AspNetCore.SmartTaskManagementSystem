using Domain;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Adapts Identity's key lookups to organization-prefixed primary keys.</summary>
/// <remarks>Register with a tenant context only after the authentication/persistence cutover.</remarks>
public sealed class TenantUserStore : UserStore<AppUser, AppRole, AppDbContext, int>
{
    public TenantUserStore(AppDbContext context, IdentityErrorDescriber? errors = null) : base(context, errors)
    {
        if (!context.IsTenantStorage) throw new InvalidOperationException("Tenant Identity requires tenant storage.");
    }

    public override Task<AppUser?> FindByIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ThrowIfDisposed();
        return Context.Users.FindAsync(new object[] { Context.TenantId, ConvertIdFromString(userId) }, cancellationToken).AsTask();
    }

    protected override Task<IdentityUserRole<int>?> FindUserRoleAsync(int userId, int roleId, CancellationToken cancellationToken)
        => Context.Set<IdentityUserRole<int>>().FindAsync(new object[] { Context.TenantId, userId, roleId }, cancellationToken).AsTask();

    protected override Task<IdentityUserToken<int>?> FindTokenAsync(AppUser user, string loginProvider, string name, CancellationToken cancellationToken)
        => Context.Set<IdentityUserToken<int>>().FindAsync(new object[] { Context.TenantId, user.Id, loginProvider, name }, cancellationToken).AsTask();
}

/// <summary>Ensures role primary-key lookup stays inside the authorized organization.</summary>
public sealed class TenantRoleStore : RoleStore<AppRole, AppDbContext, int>
{
    public TenantRoleStore(AppDbContext context, IdentityErrorDescriber? errors = null) : base(context, errors)
    {
        if (!context.IsTenantStorage) throw new InvalidOperationException("Tenant Identity requires tenant storage.");
    }

    public override Task<AppRole?> FindByIdAsync(string roleId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ThrowIfDisposed();
        return Context.Set<AppRole>().FindAsync(new object[] { Context.TenantId, ConvertIdFromString(roleId) }, cancellationToken).AsTask();
    }
}
