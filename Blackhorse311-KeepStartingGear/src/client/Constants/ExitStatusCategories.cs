// ============================================================================
// Keep Starting Gear - Exit Status Categories (SPT 3.11.4)
// ============================================================================

using EFT;

namespace Blackhorse311.KeepStartingGear.Constants;

/// <summary>
/// Categorization result for an ExitStatus.
/// </summary>
public enum ExitCategory
{
    Death,
    Extraction,
    Unknown
}

/// <summary>
/// Helper class for categorizing EFT ExitStatus values.
/// </summary>
public static class ExitStatusCategories
{
    public static ExitCategory Categorize(ExitStatus status)
    {
        switch (status)
        {
            // Death statuses - player lost gear
            case ExitStatus.Killed:
            case ExitStatus.MissingInAction:
            case ExitStatus.Left:
                return ExitCategory.Death;

            // Extraction statuses - player kept gear
            case ExitStatus.Survived:
            case ExitStatus.Runner:
            case ExitStatus.Transit:
                return ExitCategory.Extraction;

            // Unknown status
            default:
                return ExitCategory.Unknown;
        }
    }

    public static bool IsDeath(ExitStatus status) => Categorize(status) == ExitCategory.Death;

    public static bool IsExtraction(ExitStatus status) => Categorize(status) == ExitCategory.Extraction;

    public static string GetDescription(ExitStatus status)
    {
        switch (status)
        {
            case ExitStatus.Killed:
                return "Player was killed by enemy";
            case ExitStatus.MissingInAction:
                return "Raid timer expired (MIA)";
            case ExitStatus.Left:
                return "Player disconnected or left raid";
            case ExitStatus.Survived:
                return "Player extracted successfully";
            case ExitStatus.Runner:
                return "Player extracted (run-through)";
            case ExitStatus.Transit:
                return "Player used transit extract";
            default:
                return $"Unknown exit status: {status} (value: {(int)status})";
        }
    }
}
