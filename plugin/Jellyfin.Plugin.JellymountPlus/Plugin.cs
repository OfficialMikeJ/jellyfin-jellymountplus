using System;
using System.Collections.Generic;
using Jellyfin.Plugin.JellymountPlus.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.JellymountPlus;

/// <summary>
/// JellymountPlus — cinematic dark theme. Serves the theme stylesheet itself
/// and writes it into Dashboard → Branding → Custom CSS on apply.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// Fixed plugin id.
    /// </summary>
    public static readonly Guid PluginId = Guid.Parse("4b7a2e51-3c6f-4d8e-9a1b-5d7f2c8e0a34");

    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Application paths.</param>
    /// <param name="xmlSerializer">Xml serializer.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "JellymountPlus";

    /// <inheritdoc />
    public override Guid Id => PluginId;

    /// <inheritdoc />
    public override string Description =>
        "JellymountPlus cinematic dark theme for Jellyfin Web.";

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        var ns = GetType().Namespace!;
        return new[]
        {
            new PluginPageInfo
            {
                Name = "JellymountPlus",
                EmbeddedResourcePath = ns + ".Configuration.configPage.html"
            }
        };
    }
}
