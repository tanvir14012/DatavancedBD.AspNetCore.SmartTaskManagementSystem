-- Authority directory baseline for the control-plane database.
-- Execute through the reviewed Admin release process, never web startup.
-- The migration runner must make this operation idempotent for existing deployments.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'[catalog].[TenantAuthorities]', N'U') IS NULL
BEGIN
    CREATE TABLE [catalog].[TenantAuthorities]
    (
        [Authority] nvarchar(259) COLLATE Latin1_General_100_BIN2 NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_TenantAuthorities] PRIMARY KEY ([Authority]),
        CONSTRAINT [FK_TenantAuthorities_TenantPlacements] FOREIGN KEY ([TenantId])
            REFERENCES [catalog].[TenantPlacements] ([TenantId]),
        CONSTRAINT [CK_TenantAuthorities_Authority] CHECK
            (DATALENGTH([Authority]) > 0 AND DATALENGTH([Authority]) = DATALENGTH(LTRIM(RTRIM([Authority])))
             AND [Authority] = LOWER([Authority]) AND [Authority] NOT LIKE N'%[^a-z0-9.:-]%'
             AND LEFT([Authority], 1) LIKE N'[a-z0-9]')
    );
END;

COMMIT TRANSACTION;
