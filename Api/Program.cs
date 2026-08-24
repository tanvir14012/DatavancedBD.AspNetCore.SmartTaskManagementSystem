using Infrastructure.AssemblyScan;
using Infrastructure.Bootstrap;
using Infrastructure.Data.EfCore.Persistence.Seeding;

var builder = WebApplication.CreateBuilder(args);

builder.AddDefaultBootstrap();

builder.Services
    .AddScopedServices(typeof(Program).Assembly)
    .AddTransientServices(typeof(Program).Assembly)
    .AddSingletonServices(typeof(Program).Assembly);

builder.Services.AddEndpoints(typeof(Program).Assembly);
builder.Services.AddObservability(builder.Configuration, Shared.Constants.ServiceName);

var app = builder.Build()
    .UseDefaultMiddleware();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

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
