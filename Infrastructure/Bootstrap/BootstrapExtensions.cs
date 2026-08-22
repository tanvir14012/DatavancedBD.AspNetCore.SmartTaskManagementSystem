using System.Threading.RateLimiting;
using Asp.Versioning;
using Infrastructure.Bootstrap.Middleware;
using Infrastructure.Bootstrap.Options;
using Infrastructure.Caching.Extensions;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;

namespace Infrastructure.Bootstrap;

public static class BootstrapExtensions
{
    public static WebApplicationBuilder AddDefaultBootstrap(this WebApplicationBuilder builder)
    {

        var loggerConfiguration = new LoggerConfiguration()
            .ReadFrom.Configuration(builder.Configuration)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", builder.Environment.ApplicationName)
            .WriteTo.Console()
            .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day);



        Log.Logger = loggerConfiguration.CreateLogger();

        builder.Host.UseSerilog();

        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Postgres connection string is required.");
        builder.Services.AddServiceDbContext<AppDbContext>(connectionString, Shared.Constants.ServicePrefix);
        builder.Services.AddAutoMigrations<AppDbContext>();
        builder.Services.AddCustomIdentity();

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
                policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
        });

        builder.Services.AddOpenApi();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddTransient<RequestTracingMiddleware>();
        builder.Services.AddTransient<AuditLoggingMiddleware>();
        builder.Services.AddCaching(builder.Configuration);
        builder.Services.AddHttpResponseCaching(builder.Configuration);

        builder.Services
            .AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = builder.Configuration["Jwt:Authority"];
                options.Audience = builder.Configuration["Jwt:Audience"];
                options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            });

        builder.Services.AddAuthorization();

        // ── API Versioning ────────────────────────────────────────────────────
        // Reads ?api-version= query param and api-version header — matches the
        // Angular apiVersionInterceptor which sends both on every request.
        builder.Services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
            options.ApiVersionReader = ApiVersionReader.Combine(
                new QueryStringApiVersionReader("api-version"),
                new HeaderApiVersionReader("api-version"));
        });

        // ── Rate Limiting ─────────────────────────────────────────────────────
        // Global sliding-window + named policies. The Angular rateLimitInterceptor
        // reads the Retry-After header (delta-seconds) and auto-retries up to 2×.
        var rateLimitCfg = builder.Configuration
            .GetSection(RateLimitingOptions.SectionName)
            .Get<RateLimitingOptions>() ?? new RateLimitingOptions();

        builder.Services.Configure<RateLimitingOptions>(
            builder.Configuration.GetSection(RateLimitingOptions.SectionName));

        builder.Services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.OnRejected = async (context, cancellationToken) =>
            {
                var retryAfterSeconds = rateLimitCfg.Global.WindowSeconds;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    retryAfterSeconds = (int)Math.Ceiling(retryAfter.TotalSeconds);
                }

                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.HttpContext.Response.Headers["Retry-After"] = retryAfterSeconds.ToString();
                context.HttpContext.Response.ContentType = "application/problem+json";

                await context.HttpContext.Response.WriteAsync(
                    System.Text.Json.JsonSerializer.Serialize(new
                    {
                        type = "https://tools.ietf.org/html/rfc6585#section-4",
                        title = "Too Many Requests",
                        status = 429,
                        detail = $"Rate limit exceeded. Retry after {retryAfterSeconds} second(s).",
                    }),
                    cancellationToken);
            };

            if (rateLimitCfg.Enabled)
            {
                // Global limiter — applies to every request automatically (no attribute needed).
                limiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
                    context =>
                    {
                        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                        return RateLimitPartition.GetSlidingWindowLimiter(ip, _ =>
                            new SlidingWindowRateLimiterOptions
                            {
                                PermitLimit = rateLimitCfg.Global.PermitLimit,
                                Window = TimeSpan.FromSeconds(rateLimitCfg.Global.WindowSeconds),
                                SegmentsPerWindow = 4,
                                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                                QueueLimit = rateLimitCfg.Global.QueueLimit,
                            });
                    });
            }

            // Named policy: upload endpoints — use .RequireRateLimiting(RateLimitPolicies.Upload)
            limiterOptions.AddFixedWindowLimiter(RateLimitPolicies.Upload, opts =>
            {
                opts.PermitLimit = rateLimitCfg.Upload.PermitLimit;
                opts.Window = TimeSpan.FromSeconds(rateLimitCfg.Upload.WindowSeconds);
                opts.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                opts.QueueLimit = rateLimitCfg.Upload.QueueLimit;
            });

            // Named policy: auth / write-sensitive endpoints
            limiterOptions.AddFixedWindowLimiter(RateLimitPolicies.Strict, opts =>
            {
                opts.PermitLimit = rateLimitCfg.Strict.PermitLimit;
                opts.Window = TimeSpan.FromSeconds(rateLimitCfg.Strict.WindowSeconds);
                opts.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                opts.QueueLimit = rateLimitCfg.Strict.QueueLimit;
            });
        });

        return builder;
    }

    public static WebApplication UseDefaultMiddleware(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseMiddleware<RequestTracingMiddleware>();

        app.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                var feature = context.Features.Get<IExceptionHandlerFeature>();
                var ex = feature?.Error;
                context.Response.StatusCode = 500;
                context.Response.ContentType = "application/problem+json";
                var problem = new
                {
                    type = "https://tools.ietf.org/html/rfc7807",
                    title = "An unexpected error occurred.",
                    status = 500,
                    detail = app.Environment.IsDevelopment() ? ex?.Message : "Internal server error.",
                    traceId = context.Response.Headers[RequestTracingMiddleware.TraceIdHeaderName].ToString()
                };
                var json = System.Text.Json.JsonSerializer.Serialize(
                    problem,
                    new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
                await context.Response.WriteAsync(json);
            });
        });

        app.UseSerilogRequestLogging();
        app.UseCors();
        app.UseRateLimiter();   // 429 + Retry-After before auth — protects all endpoints
        app.UseHttpResponseCaching();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMiddleware<AuditLoggingMiddleware>();

        return app;
    }
}
