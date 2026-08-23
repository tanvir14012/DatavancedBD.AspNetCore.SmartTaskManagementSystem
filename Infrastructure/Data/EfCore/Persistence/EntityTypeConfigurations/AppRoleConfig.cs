using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;

public class AppRoleConfig : IEntityTypeConfiguration<AppRole>
{
    public void Configure(EntityTypeBuilder<AppRole> builder)
    {
        builder.Property(u => u.Description).HasMaxLength(1000);

        builder.HasOne(u => u.CreatedBy)
               .WithMany()
               .HasForeignKey(p => p.CreatedById)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
