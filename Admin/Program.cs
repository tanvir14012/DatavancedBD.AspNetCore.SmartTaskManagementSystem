using Application.Tenancy;
using Infrastructure.Tenancy.Catalog;
using Infrastructure.Tenancy.Migrations;
using Infrastructure.Tenancy.Persistence;
using Infrastructure.Tenancy.Provisioning;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddTenantStorage();
builder.Services.AddTenantMigrations(builder.Configuration);
builder.Services.AddTenantCatalog(builder.Configuration);
builder.Services.AddTenantProvisioning();

using var host = builder.Build();
using var cancellation = new CancellationTokenSource();
ConsoleCancelEventHandler? cancelHandler = (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};
Console.CancelKeyPress += cancelHandler;

try
{
    if (args.Length == 0)
    {
        Console.Error.WriteLine("Usage: Admin migrate | provision <tenant-id> <Database|Schema|Row>");
        return 2;
    }

    switch (args[0].ToLowerInvariant())
    {
        case "migrate" when args.Length == 1:
        {
            var outcomes = await host.Services.GetRequiredService<ITenantMigrationRunner>()
                .RunAsync(cancellation.Token);
            foreach (var outcome in outcomes)
                Console.WriteLine($"{outcome.Target.TargetId}\t{outcome.Target.Schema ?? "-"}\t{(outcome.Succeeded ? "ok" : outcome.ErrorCode)}");
            return outcomes.All(outcome => outcome.Succeeded) ? 0 : 1;
        }
        case "provision" when args.Length == 3 &&
            Guid.TryParse(args[1], out var tenantId) &&
            Enum.TryParse<TenantIsolation>(args[2], ignoreCase: false, out var isolation) &&
            Enum.IsDefined(isolation):
            await host.Services.GetRequiredService<ITenantProvisioner>()
                .ProvisionAsync(tenantId, isolation, cancellation.Token);
            Console.WriteLine($"{tenantId:D}\t{isolation}\tok");
            return 0;
        default:
            Console.Error.WriteLine("Invalid command. Usage: Admin migrate | provision <tenant-id> <Database|Schema|Row>");
            return 2;
    }
}
catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
{
    Console.Error.WriteLine("Operation canceled.");
    return 1;
}
catch (Exception error)
{
    Console.Error.WriteLine($"Administration failed: {error.GetType().Name}");
    return 1;
}
finally
{
    Console.CancelKeyPress -= cancelHandler;
}
