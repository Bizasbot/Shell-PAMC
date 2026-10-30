-- Retire the Playground's saved conversation
-- The Playground page no longer exists, so its single stored session
-- (`playground_session`) has no reader or writer and the API no longer accepts the key.
-- Remove the orphaned row rather than leave an unreadable document in operator preferences.
DELETE FROM ui_preferences WHERE pref_key = 'playground_session';
