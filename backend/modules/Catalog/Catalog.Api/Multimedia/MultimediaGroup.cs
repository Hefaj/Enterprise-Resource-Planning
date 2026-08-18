using FastEndpoints;

namespace Catalog.Multimedia;

public class MultimediaGroup : Group
{
    public MultimediaGroup()
    {
        Configure("multimedia", ep =>
        {
        });
    }
}
