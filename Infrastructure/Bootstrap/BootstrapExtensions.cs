using System.Text;
using System.Threading.RateLimiting;
using Asp.Versioning;
using Infrastructure.Bootstrap.Middleware;
using Infrastructure.Bootstrap.Options;
using Infrastructure.Caching.Extensions;
using Infrastructure.Data.EfCore.Extensions;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
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
            var corsSection = builder.Configuration.GetSection("Cors");
            var allowedOrigins = corsSection.GetSection("AllowedOrigins").Get<string[]>() ?? 
                new[] { "https://localhost:4200", "http://localhost:4200" };

            options.AddDefaultPolicy(policy =>
                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials());
        });

        builder.Services.AddOpenApi();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddTransient<RequestTracingMiddleware>();
        builder.Services.AddTransient<AuditLoggingMiddleware>();
        builder.Services.AddCaching(builder.Configuration);
        builder.Services.AddHttpResponseCaching(builder.Configuration);

       builder.Services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                var issuer = builder.Configuration["Jwt:Issuer"] ?? "https://localhost:7108";
                var audience = builder.Configuration["Jwt:Audience"] ?? "https://localhost:4200";
                var key = builder.Configuration["Jwt:Key"] ?? "ThisIsADevelopmentJwtSigningKey_ReplaceInProduction!";

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = issuer,
                    ValidAudience = audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
                };
            });

        builder.Services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build());

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

        builder.Services.AddHealthChecks();
        builder.Services.AddSwaggerGen(options =>
        {
            options.CustomSchemaIds(type => type.FullName);
        });

        return builder;
    }

    public static WebApplication UseDefaultMiddleware(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi().AllowAnonymous();
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseMiddleware<RequestTracingMiddleware>();
        app.UseCors(); // CORS must be before exception handler to handle preflight requests

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
        app.UseRateLimiter();   // 429 + Retry-After before auth — protects all endpoints
        app.UseHttpResponseCaching();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMiddleware<AuditLoggingMiddleware>();

        return app;
    }
}
