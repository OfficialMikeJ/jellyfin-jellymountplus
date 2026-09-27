using System;
using Jellyfin.Plugin.JellymountPlus.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Branding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.JellymountPlus.Controllers;

/// <summary>
/// Applies/removes the theme by writing an <c>@import</c> into Jellyfin's
/// Branding Custom CSS — the supported, server-side theme mechanism on every
/// platform, no webroot or index.html edits.
/// </summary>
[ApiController]
[Route("JellymountPlus")]
public class ThemeController : ControllerBase
{
    private const string ThemeUrl = "/JellymountPlus/Assets/theme.css";
    private const string FullThemeUrl = "/JellymountPlus/Assets/theme-full.css";
    private const string ImportMarker = "JellymountPlus/Assets/";

    private readonly IServerConfigurationManager _configManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="ThemeController"/> class.
    /// </summary>
    /// <param name="configManager">Instance of the <see cref="IServerConfigurationManager"/> interface.</param>
    public ThemeController(IServerConfigurationManager configManager)
    {
        _configManager = configManager;
    }

    /// <summary>GET /JellymountPlus/Status — whether our @import is present.</summary>
    [HttpGet("Status")]
    [Authorize(Policy = "RequiresElevation")]
    public ActionResult<object> Status()
    {
        var css = GetBranding().CustomCss ?? string.Empty;
        var applied = css.Contains(ImportMarker, StringComparison.Ordinal);
        var first = css.TrimStart();
        return new
        {
            applied,
            /* @import only works as the first rule — surface when something
               else sits above it so the user knows why nothing renders. */
            importFirst = first.StartsWith(ImportLine(), StringComparison.Ordinal),
            extras = Plugin.Instance?.Configuration.ExtrasEnabled ?? false,
            currentImport = applied ? ImportLine() : null
        };
    }

    /// <summary>POST /JellymountPlus/Apply — write our @import into Branding CSS.</summary>
    [HttpPost("Apply")]
    [Authorize(Policy = "RequiresElevation")]
    public ActionResult Apply()
    {
        var options = GetBranding();
        var css = RemoveOurLines(options.CustomCss ?? string.Empty);
        /* @import must precede all other rules or the browser drops it —
           prepend, never append. */
        options.CustomCss = string.IsNullOrWhiteSpace(css)
            ? ImportLine()
            : ImportLine() + Environment.NewLine + css.TrimStart();
        _configManager.SaveConfiguration("branding", options);

        if (Plugin.Instance is { } p)
        {
            p.Configuration.ThemeApplied = true;
            p.SaveConfiguration();
        }

        return NoContent();
    }

    /// <summary>POST /JellymountPlus/Remove — strip our @import, keep other CSS.</summary>
    [HttpPost("Remove")]
    [Authorize(Policy = "RequiresElevation")]
    public ActionResult Remove()
    {
        var options = GetBranding();
        options.CustomCss = RemoveOurLines(options.CustomCss ?? string.Empty);
        _configManager.SaveConfiguration("branding", options);

        if (Plugin.Instance is { } p)
        {
            p.Configuration.ThemeApplied = false;
            p.SaveConfiguration();
        }

        return NoContent();
    }

    private static string ImportLine()
        => "@import url('" + (Plugin.Instance?.Configuration.ExtrasEnabled == true ? FullThemeUrl : ThemeUrl) + "');";

    private BrandingOptions GetBranding()
        => _configManager.GetConfiguration<BrandingOptions>("branding");

    /// <summary>Drop only the lines that import our theme; leave user's other CSS alone.</summary>
    private static string RemoveOurLines(string css)
    {
        var lines = css.Split('\n');
        var kept = Array.FindAll(
            lines,
            l => !l.Contains(ImportMarker, StringComparison.Ordinal));
        return string.Join('\n', kept).Trim();
    }
}
