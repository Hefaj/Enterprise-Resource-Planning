using FastEndpoints;

namespace Catalog.Codes;

public class CodeTypeGroup : Group
{
    public CodeTypeGroup()
    {
        Configure("codeType", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
