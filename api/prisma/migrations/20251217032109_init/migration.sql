BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Floor] (
    [floorId] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [orderIndex] INT NOT NULL,
    CONSTRAINT [Floor_pkey] PRIMARY KEY CLUSTERED ([floorId])
);

-- CreateTable
CREATE TABLE [dbo].[Ring] (
    [ringId] INT NOT NULL IDENTITY(1,1),
    [floorId] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [radiusIndex] INT NOT NULL,
    [slots] INT NOT NULL,
    CONSTRAINT [Ring_pkey] PRIMARY KEY CLUSTERED ([ringId])
);

-- CreateTable
CREATE TABLE [dbo].[Pod] (
    [podId] INT NOT NULL IDENTITY(1,1),
    [floorId] INT NOT NULL,
    [ringId] INT NOT NULL,
    [slotIndex] INT NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [podType] NVARCHAR(1000) NOT NULL CONSTRAINT [Pod_podType_df] DEFAULT 'standard',
    CONSTRAINT [Pod_pkey] PRIMARY KEY CLUSTERED ([podId]),
    CONSTRAINT [Pod_ringId_slotIndex_key] UNIQUE NONCLUSTERED ([ringId],[slotIndex])
);

-- CreateTable
CREATE TABLE [dbo].[Entity] (
    [entityId] INT NOT NULL IDENTITY(1,1),
    [entityType] NVARCHAR(1000) NOT NULL,
    [displayName] NVARCHAR(1000) NOT NULL,
    [externalSystemId] NVARCHAR(1000),
    CONSTRAINT [Entity_pkey] PRIMARY KEY CLUSTERED ([entityId])
);

-- CreateTable
CREATE TABLE [dbo].[PodAssignment] (
    [assignmentId] INT NOT NULL IDENTITY(1,1),
    [podId] INT NOT NULL,
    [entityId] INT NOT NULL,
    [roleTag] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PodAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PodAssignment_pkey] PRIMARY KEY CLUSTERED ([assignmentId]),
    CONSTRAINT [PodAssignment_podId_entityId_key] UNIQUE NONCLUSTERED ([podId],[entityId])
);

-- CreateTable
CREATE TABLE [dbo].[LayoutSnapshot] (
    [snapshotId] INT NOT NULL IDENTITY(1,1),
    [floorId] INT NOT NULL,
    [jsonLayout] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LayoutSnapshot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [LayoutSnapshot_pkey] PRIMARY KEY CLUSTERED ([snapshotId])
);

-- AddForeignKey
ALTER TABLE [dbo].[Ring] ADD CONSTRAINT [Ring_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([floorId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Pod] ADD CONSTRAINT [Pod_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([floorId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Pod] ADD CONSTRAINT [Pod_ringId_fkey] FOREIGN KEY ([ringId]) REFERENCES [dbo].[Ring]([ringId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PodAssignment] ADD CONSTRAINT [PodAssignment_podId_fkey] FOREIGN KEY ([podId]) REFERENCES [dbo].[Pod]([podId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PodAssignment] ADD CONSTRAINT [PodAssignment_entityId_fkey] FOREIGN KEY ([entityId]) REFERENCES [dbo].[Entity]([entityId]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LayoutSnapshot] ADD CONSTRAINT [LayoutSnapshot_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([floorId]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
