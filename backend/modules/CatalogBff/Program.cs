using FastEndpoints;
using FastEndpoints.Swagger;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
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