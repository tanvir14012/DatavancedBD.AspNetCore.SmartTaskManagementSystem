# Deployment Guide: Angular SPA & .NET API on IIS

This guide walks you through deploying the Angular frontend and ASP.NET Core backend under a single IIS website using HTTPS and application pool isolation.

---

## Prerequisites & Requirements

* Operating System: Windows 10/11 or Windows Server 2016+
* Frameworks: .NET 10 SDK and Node.js / Angular CLI installed on the build machine
* Administrator privileges: required for IIS, hosts file, and certificate store configuration

---

## Step 1: Enable IIS on Windows

### Option A: Windows Server (PowerShell)

Run PowerShell as Administrator:

```powershell
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
```

### Option B: Windows 10 / 11 (GUI)

1. Press Win + R, type `optionalfeatures`, and press Enter.
2. Check Internet Information Services.
3. Expand World Wide Web Services -> Application Development Features and enable:
   * .NET Extensibility 4.8
   * ASP.NET 4.8
   * WebSocket Protocol (required for Angular HMR/SignalR if used)
4. Click OK and wait for installation to complete.

---

## Step 2: Download & Install IIS URL Rewrite Module

The Angular single-page application requires the URL Rewrite module to handle client-side routing.

1. Download IIS URL Rewrite Module 2.1 from the official Microsoft download page.
2. Run the installer (`rewrite_amd64_en-US.msi`) and complete setup.
3. Open IIS Manager (`inetmgr`) and confirm the URL Rewrite feature icon appears under the server features.

---

## Step 3: Hostname & DNS Setup

### For local testing (Windows hosts file)

1. Open PowerShell or Notepad as Administrator.
2. Open `C:\Windows\System32\drivers\etc\hosts`.
3. Add the following entry at the bottom:

```text
127.0.0.1    stms.com
```

4. Save and close the file.

### For production server

Point an A record in your DNS provider (for example, Cloudflare or GoDaddy) directing `stms.com` to your Windows Server public IP address.

---

## Step 4: Build & Publish Applications

### 1. Publish the .NET API

Publish as a self-contained 64-bit Windows deployment to `C:\publish\api`:

```bash
dotnet publish -c Release -r win-x64 --self-contained true -o "C:\publish\api"
```

### 2. Build & publish the Angular SPA

1. Set the production API base URL in `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiBaseUrl: '/services/api'
};
```

2. Build the production bundle:

```bash
ng build --configuration production --output-path="C:\publish\client"
```

---

## Step 5: Create the Angular `web.config`

Create a file named `web.config` inside `C:\publish\client\` with the following contents:

> Critical: the `<conditions>` block includes `negate="true"` patterns for `/services` and `/api` so IIS does not redirect API requests into Angular's `index.html`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Angular Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />

            <add input="{REQUEST_URI}" pattern="^/services" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

---

## Step 6: Configure Application Pools in IIS

For security and performance, isolate the Angular static site and the .NET API into separate application pools without .NET CLR loaded (since .NET 10 runs in-process/self-contained).

1. Open IIS Manager (`inetmgr`).
2. Click Application Pools in the left menu.
3. Click Add Application Pool... (Create Pool 1):
   * Name: `STMS-Web-Pool`
   * .NET CLR Version: `No Managed Code`
   * Managed Pipeline Mode: `Integrated`
4. Click Add Application Pool... (Create Pool 2):
   * Name: `STMS-Api-Pool`
   * .NET CLR Version: `No Managed Code`
   * Managed Pipeline Mode: `Integrated`

---

## Step 7: Configure File System Permissions

IIS AppPool identities need explicit permission to access physical files.

1. Navigate to `C:\publish`.
2. For `C:\publish\client` (Angular):
   * Right-click `client` -> Properties -> Security -> Edit... -> Add...
   * Enter `IIS AppPool\STMS-Web-Pool` and click Check Names
   * Grant Read & Execute, List Folder Contents, and Read permissions
3. For `C:\publish\api` (.NET API):
   * Right-click `api` -> Properties -> Security -> Edit... -> Add...
   * Enter `IIS AppPool\STMS-Api-Pool` and click Check Names
   * Grant Read & Execute, List Folder Contents, and Read permissions

---

## Step 8: Set Up IIS Website & HTTPS SSL Binding

1. In IIS Manager, right-click Sites -> Add Website...
2. Configure initial settings:
   * Site name: `STMS`
   * Application pool: `STMS-Web-Pool`
   * Physical path: `C:\publish\client`
   * Binding type: `https`
   * IP Address: `All Unassigned`
   * Port: `443`
   * Host name: `stms.com`
3. SSL certificate selection:
   * Development/local: select the IIS Development Certificate or a certificate generated by `New-SelfSignedCertificate`. Ensure SNI is used if needed.
   * Production: select your installed domain SSL certificate (DigiCert, Let’s Encrypt via win-acme, etc.)

---

## Step 9: Add API Sub-Application (`/services`)

1. In IIS Manager, expand Sites -> right-click STMS -> Add Application...
2. Configure settings:
   * Alias: `services`
   * Application pool: `STMS-Api-Pool`
   * Physical path: `C:\publish\api`
3. Click OK.

---

## Step 10: Verification & Troubleshooting

1. Open PowerShell and restart IIS:

```powershell
iisreset
```

2. Open a browser and visit `https://stms.com`:
   * The Angular app should render correctly.
   * Refreshing non-root pages such as `https://stms.com/dashboard` should load without 404 errors.
   * The API login endpoint should resolve to the .NET API at `https://stms.com/services/api/auth/login` without returning 401, 403, or 404 errors.

### Common troubleshooting matrix

| Error Code | Root Cause | Solution |
| --- | --- | --- |
| `403.18 Forbidden` | Cross-AppPool execution conflict | Ensure `web.config` contains `<add input="{REQUEST_URI}" pattern="^/services" negate="true" />` |
| `401 Unauthorized` | IIS path stripping causing route mismatches | Verify Angular is requesting `/services/api/...` so IIS strips `/services` and hands `/api/...` to the .NET app |
| `500.19 Internal Server Error` | Missing URL Rewrite Module | Re-run the `rewrite_amd64_en-US.msi` installer and restart IIS |
| `503 Service Unavailable` | AppPool crash due to permission issues | Re-verify IIS AppPool permissions for `C:\publish\api` |

---

## Additional Production Notes

* Keep the Angular site root and API sub-application on the same hostname to simplify authentication cookies and CORS behavior.
* Use a dedicated certificate and enforce HTTPS only in production.
* If the app uses a database, configure its connection string before deployment and ensure the IIS AppPool identity has access to that database or use a SQL Server login with the appropriate rights.
* Consider configuring HTTP to HTTPS redirect rules and setting strict security headers for production deployments.

This setup gives you a clean hosting model for a modern Angular frontend and ASP.NET Core backend behind IIS while keeping static assets and API endpoints isolated and easy to manage.
