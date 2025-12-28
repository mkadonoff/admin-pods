/*
  Warnings:

  - You are about to drop the column `jsonData` on the `Assembly` table. All the data in the column will be lost.
  - Added the required column `assemblyId` to the `Floor` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[Pod] DROP CONSTRAINT [Pod_floorId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[Ring] DROP CONSTRAINT [Ring_floorId_fkey];

-- AlterTable
ALTER TABLE [dbo].[Assembly] DROP COLUMN [jsonData];

-- AlterTable
ALTER TABLE [dbo].[Floor] ADD CONSTRAINT [Floor_orderIndex_df] DEFAULT 0 FOR [orderIndex];
ALTER TABLE [dbo].[Floor] ADD [assemblyId] INT NOT NULL;

-- AddForeignKey
ALTER TABLE [dbo].[Floor] ADD CONSTRAINT [Floor_assemblyId_fkey] FOREIGN KEY ([assemblyId]) REFERENCES [dbo].[Assembly]([assemblyId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Ring] ADD CONSTRAINT [Ring_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([floorId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Pod] ADD CONSTRAINT [Pod_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([floorId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
