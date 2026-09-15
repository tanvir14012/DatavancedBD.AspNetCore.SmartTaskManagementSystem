using Application.Tenancy;
using Infrastructure.Tenancy.Resilience;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddTenantWorker(builder.Configuration);
using var host = builder.Build();

if (args.Length != 1 || !args[0].Equals("run", StringComparison.OrdinalIgnoreCase))
{
    Console.Error.WriteLine("Usage: Worker run");
    return 2;
}

if (host.Services.GetService<ITenantWorkHandler>() is null)
{
    Console.Error.WriteLine("Worker requires an explicit ITenantWorkHandler adapter.");
    return 2;
}

using var cancellation = new CancellationTokenSource();
ConsoleCancelEventHandler? cancelHandler = (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};
Console.CancelKeyPress += cancelHandler;
try
{
    await host.Services.GetRequiredService<TenantWorker>().RunAsync(cancellation.Token);
    return 0;
}
catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
{
    return 0;
}
finally
{
    Console.CancelKeyPress -= cancelHandler;
}
