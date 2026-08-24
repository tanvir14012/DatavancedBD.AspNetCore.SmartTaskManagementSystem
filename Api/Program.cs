using Api.Options;
using Application.Interfaces;
using Infrastructure.AssemblyScan;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence;
using Application;

var builder = WebApplication.CreateBuilder(args);

builder.AddDefaultBootstrap();
builder.Services.Configure<AuthenticationOptions>(builder.Configuration.GetSection(AuthenticationOptions.SectionName));

builder.Services
    .AddScopedServices(typeof(Program).Assembly, typeof(ICurrentUser).Assembly, typeof(AppDbContext).Assembly)
    .AddTransientServices(typeof(Program).Assembly, typeof(ICurrentUser).Assembly, typeof(AppDbContext).Assembly)
    .AddSingletonServices(typeof(Program).Assembly, typeof(ICurrentUser).Assembly, typeof(AppDbContext).Assembly);

builder.Services.AddEndpoints(typeof(Program).Assembly);
builder.Services.AddObservability(builder.Configuration, Shared.Constants.ServiceName);

builder.Services.AddApplication();
builder.Services.AddAutoMapper(cfg => { }, typeof(ICurrentUser).Assembly);

var app = builder.Build()
    .UseDefaultMiddleware();

app.UseHttpsRedirection();

app.MapEndpoints();

app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Ok(new
{
    Service = Shared.Constants.ServiceName,
    Status = "Up",
    Utc = DateTimeOffset.UtcNow
}));

app.Run();
