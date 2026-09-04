using Infrastructure.Bootstrap.Options;
using Application.Interfaces;
using Infrastructure.Bootstrap;
using Infrastructure.AssemblyScan;
using Infrastructure.Data.EfCore.Persistence;
using Application;
using Infrastructure.Services;

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

builder.Services.AddApplication();
builder.Services.AddAutoMapper(cfg => { }, typeof(ICurrentUser).Assembly);

var app = builder.Build()
    .UseDefaultMiddleware();

app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Ok(new
{
    Service = Shared.Constants.ServiceName,
    Status = "Up",
    Utc = DateTimeOffset.UtcNow
}));

app.Run();
