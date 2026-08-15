using FastEndpoints;

namespace Catalog.CodeType;

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
