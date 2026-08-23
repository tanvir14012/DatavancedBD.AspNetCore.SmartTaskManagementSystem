using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Persistence.EntityTypeConfigurations;

public class JoinTablesConfiguration :
    IEntityTypeConfiguration<UserProject>,
    IEntityTypeConfiguration<UserTask>
{
    public void Configure(EntityTypeBuilder<UserProject> builder)
    {
        builder.HasKey(up => new { up.UserId, up.ProjectId });

        builder.HasOne(up => up.User)
               .WithMany(u => u.Projects)
               .HasForeignKey(up => up.UserId);

        builder.HasOne(up => up.Project)
               .WithMany(p => p.Members)
               .HasForeignKey(up => up.ProjectId);
    }

    public void Configure(EntityTypeBuilder<UserTask> builder)
    {
        builder.HasKey(ut => new { ut.UserId, ut.TaskId });

        builder.HasOne(ut => ut.User)
               .WithMany(u => u.Tasks)
               .HasForeignKey(ut => ut.UserId);

        builder.HasOne(ut => ut.Task)
               .WithMany(t => t.Assignees)
               .HasForeignKey(ut => ut.TaskId);

        builder.HasOne(ut => ut.AssignedBy)
               .WithMany()
               .HasForeignKey(ut => ut.AssignedById)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
