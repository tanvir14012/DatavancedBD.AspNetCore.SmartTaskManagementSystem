using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;

public class ProjectTaskConfig: IEntityTypeConfiguration<ProjectTask>
{
    public void Configure(EntityTypeBuilder<ProjectTask> builder)
    {
        builder.HasQueryFilter(t => !t.IsDeleted);

        builder.Property(t => t.Title).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(4000);

        builder.HasOne(t => t.CreatedBy)
               .WithMany()
               .HasForeignKey(t => t.CreatedById)
               .OnDelete(DeleteBehavior.Restrict);

        // Indices for dashboard statistics, search, and sorting
        builder.HasIndex(t => new { t.ProjectId, t.Status, t.Priority });
        builder.HasIndex(t => t.DueDate);

        // Computed normalized column for predictable text matching
        builder.Property<string>("SearchVectorPrefix")
            .HasComputedColumnSql(
                "LEFT(LOWER(ISNULL([Title], '') + ' ' + ISNULL([Description], '')), 800)",
                stored: true);

        // Non-Clustered Index over SearchVector (with Included Columns for speed)
        builder.HasIndex("SearchVector")
               .IncludeProperties(t => new { t.ProjectId, t.Status, t.Priority });
    }
}
