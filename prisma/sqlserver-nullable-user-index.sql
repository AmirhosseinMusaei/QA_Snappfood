-- Preserve unique non-null links while allowing multiple unlinked agents.
-- Prisma may create either a UNIQUE constraint or a standalone unique index.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name=N'Agent_user_id_key' AND parent_object_id=OBJECT_ID(N'dbo.Agent'))
  ALTER TABLE [dbo].[Agent] DROP CONSTRAINT [Agent_user_id_key];
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'Agent_user_id_key' AND object_id=OBJECT_ID(N'dbo.Agent'))
  DROP INDEX [Agent_user_id_key] ON [dbo].[Agent];
CREATE UNIQUE INDEX [Agent_user_id_key] ON [dbo].[Agent] ([user_id]) WHERE [user_id] IS NOT NULL;
COMMIT TRANSACTION;
