using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.JellymountPlus.Configuration;

/// <summary>
/// Persisted plugin configuration.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Gets or sets a value indicating whether the theme is written into Branding Custom CSS.</summary>
    public bool ThemeApplied { get; set; }

    /// <summary>Gets or sets a value indicating whether the optional JS extras layer is enabled
    /// (hero, featured selector, hover previews, badges — injected UI beyond the theme).</summary>
    public bool ExtrasEnabled { get; set; }

    /// <summary>Gets or sets a value indicating whether hero auto-rotation is enabled (extras).</summary>
    public bool HeroAutoRotate { get; set; } = true;

    /// <summary>Gets or sets the hero rotation interval in ms (extras).</summary>
    public int HeroRotateMs { get; set; } = 18000;

    /// <summary>Gets or sets the hover preview delay in ms (extras).</summary>
    public int HoverPreviewDelayMs { get; set; } = 420;

    /// <summary>Gets or sets the wordmark text (extras logo override).</summary>
    public string LogoText { get; set; } = "JellymountPlus";

    /// <summary>Gets or sets a value indicating whether extras log to the console.</summary>
    public bool Debug { get; set; }
}
