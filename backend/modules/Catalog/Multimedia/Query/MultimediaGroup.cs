using FastEndpoints;

namespace Catalog.Multimedia.Query;

public class MultimediaGroup : Group
{
    public MultimediaGroup()
    {
        Configure("multimedia", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
