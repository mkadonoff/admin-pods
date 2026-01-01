-- Add optional content column to Entity for document payloads
ALTER TABLE [dbo].[Entity]
ADD [content] NTEXT NULL;
