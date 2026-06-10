using FastEndpoints;
using FastEndpoints.Swagger;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument();
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(
            "http://localhost:4200",
            "http://localhost:4201",
            "http://localhost:4202",
            "http://localhost:4203",
            "http://localhost:4204",
            "http://localhost:4205"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("CorsPolicy");
app.UseFastEndpoints(c =>
{
    SetEndpointName(c);
});
app.UseSwaggerGen();
app.Run();


// potrzebne zeby NSwag wygenerował dobrze nazwy endpointów
static void SetEndpointName(Config c)
{
    c.Endpoints.Configurator = ep =>
    {
        var name = ep.EndpointType.Name;
        if (name.EndsWith("Endpoint")) name = name.Replace("Endpoint", "");
        ep.Description(d => d.WithName(name));
    };
}