-- Run once after applying the schema, before importing unlinked agents.
-- SQL Server's unfiltered UNIQUE permits only one NULL, unlike SQLite.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Agent_user_id_key' AND object_id = OBJECT_ID(N'dbo.Agent'))
  DROP INDEX [Agent_user_id_key] ON [dbo].[Agent];
CREATE UNIQUE INDEX [Agent_user_id_key] ON [dbo].[Agent] ([user_id]) WHERE [user_id] IS NOT NULL;
