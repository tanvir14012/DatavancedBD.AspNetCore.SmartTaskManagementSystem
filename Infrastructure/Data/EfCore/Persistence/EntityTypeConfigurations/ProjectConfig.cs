using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;

public class ProjectConfig : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.HasQueryFilter(p => !p.IsDeleted);

        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(1000);

        builder.HasOne(p => p.CreatedBy)
               .WithMany()
               .HasForeignKey(p => p.CreatedById)
               .OnDelete(DeleteBehavior.Restrict);

        // Define SearchVector as a Shadow Property for Project
        builder.Property<string>("SearchVector")
               .HasComputedColumnSql("LOWER(ISNULL([Name], '') + ' ' + ISNULL([Description], ''))", stored: true);

        // Index the shadow property for fast LIKE '%term%' lookups
        builder.HasIndex("SearchVector");
    }
}
