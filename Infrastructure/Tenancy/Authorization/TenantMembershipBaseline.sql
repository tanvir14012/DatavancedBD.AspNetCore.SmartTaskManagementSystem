-- Initial membership baseline for a catalog with TenantPlacements already provisioned.
-- Execute through a reviewed out-of-band admin/release process, never through web startup.
-- This script intentionally fails if TenantMemberships already exists. The future migration
-- runner supplies locking, an idempotent ledger and upgrades; membership writers are separate.
-- Readers require SELECT only. Issuer is the validated token issuer, not the organization ID.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [catalog].[TenantMemberships]
(
    [TenantId] uniqueidentifier NOT NULL,
    [Issuer] nvarchar(256) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [SubjectId] nvarchar(256) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [IsActive] bit NOT NULL,
    -- Maximum key width is 1040 bytes; a nonclustered key supports up to 1700 bytes
    -- on Azure SQL / SQL Server 2016+, while a clustered key supports only 900 bytes.
    CONSTRAINT [PK_TenantMemberships] PRIMARY KEY NONCLUSTERED ([TenantId], [Issuer], [SubjectId]),
    CONSTRAINT [FK_TenantMemberships_TenantPlacements] FOREIGN KEY ([TenantId])
        REFERENCES [catalog].[TenantPlacements] ([TenantId]),
    -- SQL string comparisons pad trailing spaces even under binary collation. Reject those
    -- spellings so separate application identities cannot alias the same membership key.
    -- The application boundary additionally rejects control and surrounding Unicode whitespace.
    CONSTRAINT [CK_TenantMemberships_Issuer] CHECK
        (DATALENGTH([Issuer]) > 0 AND DATALENGTH([Issuer]) = DATALENGTH(LTRIM(RTRIM([Issuer])))),
    CONSTRAINT [CK_TenantMemberships_SubjectId] CHECK
        (DATALENGTH([SubjectId]) > 0 AND DATALENGTH([SubjectId]) = DATALENGTH(LTRIM(RTRIM([SubjectId]))))
);

COMMIT TRANSACTION;
