-- Rename Assembly table to Tower
EXEC sp_rename 'Assembly', 'Tower';

-- Rename assemblyId column to towerId in Tower table
EXEC sp_rename 'Tower.assemblyId', 'towerId', 'COLUMN';

-- Rename assemblyId column to towerId in Floor table
EXEC sp_rename 'Floor.assemblyId', 'towerId', 'COLUMN';

-- Rename foreign key constraint
DECLARE @ConstraintName nvarchar(200)
SELECT @ConstraintName = Name 
FROM sys.foreign_keys 
WHERE parent_object_id = OBJECT_ID('Floor') 
  AND referenced_object_id = OBJECT_ID('Tower')

DECLARE @SQL nvarchar(max)
SET @SQL = 'ALTER TABLE Floor DROP CONSTRAINT ' + @ConstraintName
EXEC sp_executesql @SQL

-- Add new foreign key with updated name
ALTER TABLE [Floor] ADD CONSTRAINT [Floor_towerId_fkey] FOREIGN KEY ([towerId]) REFERENCES [Tower]([towerId]) ON DELETE CASCADE ON UPDATE CASCADE;
