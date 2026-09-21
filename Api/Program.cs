using Infrastructure.Bootstrap.Options;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.AssemblyScan;
using Infrastructure.Data.EfCore.Persistence;
using Application;
using Infrastructure.Services;
using Infrastructure.Tenancy.Catalog;
using Api.Tenancy;
using Infrastructure.Tenancy.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

// Container readiness probe uses the shipped runtime; no curl/wget package is required.
if (args is ["--healthcheck"])
{
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
    try { return (await client.GetAsync("http://127.0.0.1:8080/ready")).IsSuccessStatusCode ? 0 : 1; }
    catch (HttpRequestException) { return 1; }
    catch (TaskCanceledException) { return 1; }
}

var builder = WebApplication.CreateBuilder(args);

builder.AddDefaultBootstrap();
builder.Services.Configure<AuthenticationOptions>(builder.Configuration.GetSection(AuthenticationOptions.SectionName));
builder.Services.Configure<AiOptions>(builder.Configuration.GetSection(AiOptions.SectionName));

builder.Services
    .AddScopedServices(typeof(Program).Assembly, typeof(ICurrentUser).Assembly, typeof(AppDbContext).Assembly)
    .AddTransientServices(typeof(Program).Assembly, typeof(ICurrentUser).Assembly, typeof(AppDbContext).Assembly)
    .AddSingletonServices(typeof(Program).Assembly, typeof(ICurrentUser).Assembly, typeof(AppDbContext).Assembly);

// Register AI service
builder.Services.AddScoped<IAiService, GroqModelsAiService>();
builder.Services.AddHttpClient<GroqModelsAiService>();

builder.Services.AddEndpoints(typeof(Program).Assembly);
builder.Services.AddObservability(builder.Configuration, Shared.Constants.ServiceName);
if (!builder.Environment.IsEnvironment("LocalDocker"))
{
    builder.Services.AddTenantCatalog(builder.Configuration);
    builder.Services.AddTenantAuthorization(builder.Configuration);
}
builder.Services.AddTenantStorage();

builder.Services.AddApplication();
builder.Services.AddAutoMapper(cfg => { }, typeof(ICurrentUser).Assembly);
builder.AddLocalTenant();

var app = builder.Build()
    .UseDefaultMiddleware();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapHealthChecks("/alive", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/ready").AllowAnonymous();
app.MapGet("/", () => Results.Ok(new
{
    Service = Shared.Constants.ServiceName,
    Status = "Up",
    Utc = DateTimeOffset.UtcNow
})).AllowAnonymous();

app.Run();
return 0;
