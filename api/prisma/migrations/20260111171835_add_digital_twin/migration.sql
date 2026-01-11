/*
  Warnings:

  - A unique constraint covering the columns `[digitalTwinId,displayName,entityType]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `digitalTwinId` to the `Entity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `digitalTwinId` to the `Tower` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[PodAssignment] DROP CONSTRAINT [PodAssignment_entityId_fkey];

-- DropIndex
ALTER TABLE [dbo].[Tower] DROP CONSTRAINT [Assembly_name_key];

-- AlterTable
ALTER TABLE [dbo].[Entity] ADD [digitalTwinId] INT NOT NULL;

-- AlterTable
EXEC SP_RENAME N'dbo.Assembly_pkey', N'Tower_pkey';
ALTER TABLE [dbo].[Tower] ADD [digitalTwinId] INT NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[DigitalTwin] (
    [digitalTwinId] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DigitalTwin_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DigitalTwin_pkey] PRIMARY KEY CLUSTERED ([digitalTwinId]),
    CONSTRAINT [DigitalTwin_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateIndex
ALTER TABLE [dbo].[Entity] ADD CONSTRAINT [Entity_digitalTwinId_displayName_entityType_key] UNIQUE NONCLUSTERED ([digitalTwinId], [displayName], [entityType]);

-- AddForeignKey
ALTER TABLE [dbo].[Tower] ADD CONSTRAINT [Tower_digitalTwinId_fkey] FOREIGN KEY ([digitalTwinId]) REFERENCES [dbo].[DigitalTwin]([digitalTwinId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Entity] ADD CONSTRAINT [Entity_digitalTwinId_fkey] FOREIGN KEY ([digitalTwinId]) REFERENCES [dbo].[DigitalTwin]([digitalTwinId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PodAssignment] ADD CONSTRAINT [PodAssignment_entityId_fkey] FOREIGN KEY ([entityId]) REFERENCES [dbo].[Entity]([entityId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
