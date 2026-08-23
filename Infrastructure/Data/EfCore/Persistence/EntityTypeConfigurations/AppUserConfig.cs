using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;

public class AppUserConfig : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.Property(u => u.FirstName).HasMaxLength(25).IsRequired();
        builder.Property(u => u.LastName).HasMaxLength(25).IsRequired();
        builder.Property(u => u.ImageUrl).HasMaxLength(250);

        builder.HasOne(u => u.CreatedBy)
               .WithMany()
               .HasForeignKey(p => p.CreatedById)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
