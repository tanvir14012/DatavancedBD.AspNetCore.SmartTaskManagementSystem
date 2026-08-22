using Infrastructure.AssemblyScan;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using Infrastructure.Caching.Models;

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

// ---------- MANUAL CACHE TESTS (before app.Run) ----------
// Resolve the cache service from the built app
using var scope = app.Services.CreateScope();
var cache = scope.ServiceProvider.GetRequiredService<ICacheService>();

try
{
    Console.WriteLine("=== Manual Cache Tests ===");

    // 1. Set & Get
    await cache.SetAsync("test:user", "Alice");
    var user = await cache.GetAsync<string>("test:user");
    Console.WriteLine($"Get 'test:user' -> {user}");

    // 2. Set with TTL
    await cache.SetAsync("test:ttl", "expires in 5 sec", new CacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(5) });
    var ttlValue = await cache.GetAsync<string>("test:ttl");
    Console.WriteLine($"Get 'test:ttl' (should exist) -> {ttlValue}");
    await Task.Delay(6000);
    var expired = await cache.GetAsync<string>("test:ttl");
    Console.WriteLine($"After 6s, 'test:ttl' -> {expired ?? "null (expired)"}");

    // 3. GetOrCreate
    var number = await cache.GetOrCreateAsync(
        "test:number",
        async ct => { await Task.Delay(10); return 42; });
    Console.WriteLine($"GetOrCreate 'test:number' -> {number}");

    // 4. Remove
    await cache.RemoveAsync("test:user");
    var afterRemove = await cache.GetAsync<string>("test:user");
    Console.WriteLine($"After Remove, 'test:user' -> {afterRemove ?? "null"}");

    // 5. SetMany & GetMany
    var entries = new Dictionary<string, string>
    {
        ["test:country:us"] = "USA",
        ["test:country:ca"] = "Canada"
    };
    await cache.SetManyAsync(entries);
    var countries = await cache.GetManyAsync<string>(entries.Keys);
    Console.WriteLine("GetMany results:");
    foreach (var kv in countries)
        Console.WriteLine($"  {kv.Key} -> {kv.Value}");

    // 6. SINGLE OBJECT

    var person = new Person(1, "John Doe", 30);
    await cache.SetAsync("test:person", person, new CacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1) });
    var cachedPerson = await cache.GetAsync<Person>("test:person");
    Console.WriteLine($"Single object 'test:person' -> Id={cachedPerson?.Id}, Name={cachedPerson?.Name}, Age={cachedPerson?.Age}");

    // 7. ARRAY OF OBJECTS
    var people = new[]
    {
        new Person(1, "Alice", 25),
        new Person(2, "Bob", 32),
        new Person(3, "Charlie", 28)
    };
    await cache.SetAsync("test:people", people, new CacheEntryOptions { SlidingExpiration = TimeSpan.FromSeconds(30) });
    var cachedPeople = await cache.GetAsync<Person[]>("test:people");
    Console.WriteLine($"Array of objects 'test:people' -> Count = {cachedPeople?.Length}");
    if (cachedPeople is not null)
    {
        foreach (var p in cachedPeople)
            Console.WriteLine($"  - {p.Name} (Age {p.Age})");
    }

    Console.WriteLine("=== Tests complete ===");
}
catch (Exception ex)
{
    Console.WriteLine($"ERROR during manual tests: {ex.Message}");
}

// ---------- END OF TESTS ----------

app.MapEndpoints();

app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Ok(new
{
    Service = Shared.Constants.ServiceName,
    Status = "Up",
    Utc = DateTimeOffset.UtcNow
}));

app.Run();

public record Person(int Id, string Name, int Age);
