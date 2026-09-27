using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.JellymountPlus.Controllers;

/// <summary>
/// Serves the plugin's embedded theme assets so <c>@import</c> in Branding
/// Custom CSS and optional script tags can pull them over plain GETs —
/// auth headers can't be attached to those, so this surface is anonymous
/// but strictly read-only and whitelisted.
/// </summary>
[ApiController]
[Route("JellymountPlus/Assets")]
public class AssetsController : ControllerBase
{
    private static readonly Dictionary<string, string> ContentTypes = new(System.StringComparer.OrdinalIgnoreCase)
    {
        [".css"] = "text/css",
        [".js"] = "text/javascript",
        [".svg"] = "image/svg+xml",
        [".png"] = "image/png",
        [".woff2"] = "font/woff2"
    };

    private static readonly string ResourcePrefix =
        typeof(Plugin).Namespace + ".Web.";

    private static string? GetEmbeddedText(string path)
    {
        var resourceName = ResourcePrefix + path.Replace('/', '.');
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
        if (stream is null)
        {
            return null;
        }

        using (stream)
        using (var reader = new StreamReader(stream))
        {
            return reader.ReadToEnd();
        }
    }

    /// <summary>GET /JellymountPlus/Assets/{path}.</summary>
    [HttpGet("{*path}")]
    [AllowAnonymous]
    public ActionResult GetAsset(string path)
    {
        if (string.IsNullOrEmpty(path)
            || path.Contains("..", System.StringComparison.Ordinal)
            || path.Contains('\\', System.StringComparison.Ordinal))
        {
            return NotFound();
        }

        var ext = Path.GetExtension(path);
        if (!ContentTypes.TryGetValue(ext, out var contentType))
        {
            return NotFound();
        }

        // The extras bundle is only served when explicitly enabled, and is
        // prefixed with the plugin's saved config as window.JellymountPlusConfig.
        if (ext == ".js")
        {
            if (Plugin.Instance?.Configuration.ExtrasEnabled != true)
            {
                return NotFound();
            }

            var js = GetEmbeddedText(path);
            if (js is null)
            {
                return NotFound();
            }

            var cfg = Plugin.Instance.Configuration;
            var preamble =
                "window.JellymountPlusConfig={"
                + "heroAutoRotate:" + (cfg.HeroAutoRotate ? "true" : "false") + ","
                + "heroRotateMs:" + cfg.HeroRotateMs + ","
                + "hoverPreviewDelayMs:" + cfg.HoverPreviewDelayMs + ","
                + "logoText:" + System.Text.Json.JsonSerializer.Serialize(cfg.LogoText) + ","
                + "logoUrl:'/JellymountPlus/Assets/logo.svg',"
                + "debug:" + (cfg.Debug ? "true" : "false")
                + "};";
            return Content(preamble + js, "text/javascript");
        }

        var resourceName = ResourcePrefix + path.Replace('/', '.');
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=3600";
        return File(stream, contentType);
    }
}
