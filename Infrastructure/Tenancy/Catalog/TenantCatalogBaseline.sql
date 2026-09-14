-- Initial catalog baseline for an empty control-plane database.
-- Execute only through a reviewed out-of-band admin/release process, never web startup.
-- This script intentionally fails if TenantPlacements exists. A future migration runner must
-- supply locking, an idempotent migration ledger and an explicit upgrade path for existing tables.
-- Application readers need SELECT only; provisioning/writer roles are separate future units.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF SCHEMA_ID(N'catalog') IS NULL
    EXEC(N'CREATE SCHEMA [catalog] AUTHORIZATION [dbo];');

CREATE TABLE [catalog].[TenantPlacements]
(
    [TenantId] uniqueidentifier NOT NULL,
    [Isolation] tinyint NOT NULL,
    [TargetId] nvarchar(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [SchemaName] nvarchar(128) COLLATE Latin1_General_100_BIN2 NULL,
    [Region] nvarchar(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [Version] bigint NOT NULL,
    [Lifecycle] tinyint NOT NULL,
    CONSTRAINT [PK_TenantPlacements] PRIMARY KEY ([TenantId]),
    CONSTRAINT [CK_TenantPlacements_TenantId] CHECK ([TenantId] <> '00000000-0000-0000-0000-000000000000'),
    CONSTRAINT [CK_TenantPlacements_Isolation] CHECK ([Isolation] IN (0, 1, 2)),
    CONSTRAINT [CK_TenantPlacements_Lifecycle] CHECK ([Lifecycle] IN (0, 1, 2, 3)),
    CONSTRAINT [CK_TenantPlacements_Version] CHECK ([Version] > 0),
    CONSTRAINT [CK_TenantPlacements_TargetId] CHECK
        (DATALENGTH([TargetId]) > 0 AND LEFT([TargetId], 1) LIKE N'[A-Za-z0-9]'
         AND [TargetId] NOT LIKE N'%[^A-Za-z0-9._-]%'),
    CONSTRAINT [CK_TenantPlacements_Region] CHECK
        (DATALENGTH([Region]) > 0 AND LEFT([Region], 1) LIKE N'[A-Za-z0-9]'
         AND [Region] NOT LIKE N'%[^A-Za-z0-9._-]%'),
    CONSTRAINT [CK_TenantPlacements_Schema] CHECK
        (([Isolation] = 1 AND [SchemaName] IS NOT NULL AND DATALENGTH([SchemaName]) > 0
          AND LEFT([SchemaName], 1) LIKE N'[A-Za-z_]'
          AND [SchemaName] NOT LIKE N'%[^A-Za-z0-9_]%')
         OR ([Isolation] IN (0, 2) AND [SchemaName] IS NULL))
);

COMMIT TRANSACTION;
