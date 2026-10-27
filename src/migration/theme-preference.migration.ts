import User from "../model/user.model";

/** Idempotent migration: legacy accounts without a theme inherit the OS setting. */
export default async function migrateThemePreference(): Promise<void> {
  await User.updateMany(
    {
      $or: [
        { "preferences.theme": { $exists: false } },
        { "preferences.theme": { $nin: ["light", "dark", "system"] } },
      ],
    },
    { $set: { "preferences.theme": "system" } },
  );
}
