# Deployment Guide: Ubuntu + nginx + SQL Server + .NET Runtime

This is the working setup we used for the Smart Task Management System on Ubuntu 24.04 / WSL 2 and a real Ubuntu server.

It is intentionally concise and matches the configuration that worked in practice.

---

## 1. Install the base packages

```bash
sudo apt update
sudo apt install -y wget curl libssl-dev gpg gnupg2 software-properties-common apt-transport-https lsb-release ca-certificates nginx openssl git unzip
```

---

## 2. Install SQL Server

For Ubuntu 24.04, the working workaround was the preview repo:

```bash
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg
curl -fsSL https://packages.microsoft.com/config/ubuntu/24.04/mssql-server-preview.list | sudo tee /etc/apt/sources.list.d/mssql-server-preview.list

sudo apt-get update
sudo apt-get install -y mssql-server
```

Then configure SQL Server:

```bash
sudo /opt/mssql/bin/mssql-conf setup
```

Check it:

```bash
sudo systemctl status mssql-server
```

Install the client tools:

```bash
curl -fsSL https://packages.microsoft.com/config/ubuntu/24.04/prod.list | sudo tee /etc/apt/sources.list.d/prod.list
sudo apt-get update
sudo apt-get install -y mssql-tools18 unixodbc-dev

echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
source ~/.bashrc
```

Test it:

```bash
sqlcmd -S localhost -U sa -P 'P00ntang1!' -C -Q "SELECT @@VERSION"
```

The `-C` flag is important for local/self-signed SQL Server certificates.

---

## 3. Install the system-wide .NET 10 runtime

```bash
curl -fsSL https://packages.microsoft.com/config/ubuntu/24.04/prod.list | sudo tee /etc/apt/sources.list.d/microsoft-prod.list
sudo apt-get update
sudo apt-get install -y aspnetcore-runtime-10.0
```

Verify:

```bash
/usr/lib/dotnet/dotnet --info
```

---

## 4. Copy the published app files

Create the folders:

```bash
sudo mkdir -p /var/www/stms-api
sudo mkdir -p /var/www/stms-web
sudo chown -R $USER:$USER /var/www/stms-api /var/www/stms-web
```

Use FileZilla or SFTP to copy:
- published ASP.NET Core files to `/var/www/stms-api`
- built Angular static files to `/var/www/stms-web`

---

## 5. Linux runtime config: prefer environment variables

On Linux, the app should normally be configured through environment variables in `systemd`, not only through `appsettings.json`.

`appsettings.json` can still exist for local development, but for a real Ubuntu server we pass settings like this in the service:

```ini
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment="ConnectionStrings__DefaultConnection=Server=localhost,1433;Database=SmartTaskManagementSystem;User Id=sa;Password=P00ntang1!;Encrypt=True;TrustServerCertificate=True;"
```

In practice, pass all runtime config values as environment variables, not just the connection string. Example pattern:

```ini
Environment="ConnectionStrings__DefaultConnection=..."
Environment="Jwt__Key=..."
Environment="Jwt__Issuer=..."
Environment="Jwt__Audience=..."
```

This is the correct Linux pattern when running ASP.NET Core under `systemd`.

---

## 6. Create the SSL certificate

For local testing, a self-signed cert is fine:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/stms.key \
  -out /etc/nginx/ssl/stms.crt \
  -days 365 \
  -subj "/CN=stms.local" \
  -addext "subjectAltName=DNS:stms.local,DNS:localhost,IP:127.0.0.1"
```

For a real server, replace the self-signed certificate with a proper certificate from a trusted provider (for example Comodo/Sectigo/GlobalSign or a supported CA such as Let’s Encrypt if allowed). You then point nginx to the certificate files in `/etc/ssl/...` or `/etc/nginx/ssl/...`.

---

## 7. Nginx config used successfully

Create:

```bash
sudo nano /etc/nginx/sites-available/stms
```

Use exactly this:

```nginx
server {
  listen 80;
  server_name stms.local localhost;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name stms.local localhost;

  root /var/www/stms-web;
  index index.html;

  ssl_certificate /etc/nginx/ssl/stms.crt;
  ssl_certificate_key /etc/nginx/ssl/stms.key;

  location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/stms /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Important: the trailing `/` in `proxy_pass` must be avoided. `proxy_pass http://127.0.0.1:5000;` preserves `/api` correctly.

---

## 8. Replace `stms.local` with the real domain

For local testing, the host pattern that worked was:

```bash
hostname -I
```

Example output:

```text
172.27.249.191
```

Then add this in `/etc/hosts` and the Windows hosts file:

```text
172.27.249.191 stms.local
```

For a real Ubuntu server, do not keep `stms.local` in production. Replace it with a real domain such as `app.example.com` or `stms.example.com` and configure DNS to point the A record to the server IP.

In nginx:

```nginx
server_name app.example.com www.app.example.com;
```

In the Windows host file, only keep the local test mapping while debugging. On the real server, use DNS instead of `.local`.

---

## 9. Systemd service used for the API

```bash
sudo nano /etc/systemd/system/stms-api.service
```

```ini
[Unit]
Description=Smart Task Management System API
After=network.target

[Service]
WorkingDirectory=/var/www/stms-api
ExecStart=/usr/lib/dotnet/dotnet /var/www/stms-api/Api.dll
Restart=always
RestartSec=5

Environment=ASPNETCORE_ENVIRONMENT=Production
Environment="ConnectionStrings__DefaultConnection=Server=localhost,1433;Database=SmartTaskManagementSystem;User Id=sa;Password=P00ntang1!;Encrypt=True;TrustServerCertificate=True;"

User=tanvir
Group=tanvir

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stms-api
sudo systemctl start stms-api
sudo systemctl status stms-api
```

---

## 10. Real Ubuntu server notes

### Nameservers

If the server cannot resolve public DNS names correctly:

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Example:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

Then apply:

```bash
sudo netplan apply
```

### Firewall / ports

Open the required ports:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1433/tcp
sudo ufw enable
```

If you are using a cloud firewall or security group, allow the same ports there too.

### Production certificate

On a real server, a commercial certificate is the correct setup:
- install the key and certificate chain from your SSL provider (for example Comodo/Sectigo)
- update nginx `ssl_certificate` and `ssl_certificate_key` to the live files
- set `server_name` to the real public domain
- ensure DNS points to the server IP and the certificate matches the hostname

This avoids browser warnings and makes the site work normally for end users.

---

This is the exact setup pattern that worked in practice: SQL Server on localhost, ASP.NET Core on port `5000`, nginx reverse proxy on `80/443`, and runtime config supplied via environment variables in the Linux service file.

