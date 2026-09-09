using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Data.EfCore.Persistence;

public sealed class AppDbContextFactory
    : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Allows CI/CD pipelines (and any other environment) to run `dotnet ef database update`
        // against a real database (e.g. Azure SQL) by setting ConnectionStrings__DefaultConnection.
        // Falls back to the local dev connection string when the variable isn't set.
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ??
            "Data Source=TIRELESS;" +
            "Initial Catalog=SmartTaskManagementSystem;" +
            "Integrated Security=True;" +
            "Trust Server Certificate=True;";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        optionsBuilder.UseSqlServer(connectionString);

        return new AppDbContext(optionsBuilder.Options);
    }
}
