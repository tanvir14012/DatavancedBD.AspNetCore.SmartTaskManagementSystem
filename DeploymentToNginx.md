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

The `-C` is important for local self-signed SQL Server certificates.

---

## 3. Create the database and set the connection string

```bash
sqlcmd -S localhost -U sa -P 'P00ntang1!' -C -Q "CREATE DATABASE SmartTaskManagementSystem;"
```

On the Ubuntu server, set the app connection string in:

```bash
sudo nano /var/www/stms-api/appsettings.json
```

Use:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=SmartTaskManagementSystem;User Id=sa;Password=P00ntang1!;Encrypt=True;TrustServerCertificate=True;"
  }
}
```

This was the working connection string in the live setup.

---

## 4. Install the system-wide .NET 10 runtime

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

## 5. Copy the published app files

Create the folders:

```bash
sudo mkdir -p /var/www/stms-api
sudo mkdir -p /var/www/stms-web
sudo chown -R $USER:$USER /var/www/stms-api /var/www/stms-web
```

Use FileZilla or SFTP to copy:
* published ASP.NET Core files to `/var/www/stms-api`
* built Angular static files to `/var/www/stms-web`

---

## 6. Create the self-signed SSL cert

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/stms.key \
  -out /etc/nginx/ssl/stms.crt \
  -days 365 \
  -subj "/CN=stms.local" \
  -addext "subjectAltName=DNS:stms.local,DNS:localhost,IP:127.0.0.1"
```

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

---

## 8. Host name mapping used on the real machine

On Ubuntu:

```bash
hostname -I
```

Example output:

```text
172.27.249.191
```

Then in Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`):

```text
172.27.249.191 stms.local
```

And in Ubuntu `/etc/hosts`:

```bash
sudo nano /etc/hosts
```

```text
172.27.249.191 stms.local
```

This is the exact hostname pattern that worked in practice.

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

For a real server, also make sure:

```bash
sudo nano /etc/systemd/resolved.conf
```

Add:

```ini
[Resolve]
DNS=1.1.1.1 8.8.8.8
FallbackDNS=1.1.1.1 8.8.8.8
```

Then:

```bash
sudo systemctl restart systemd-resolved
```

Allow the required ports:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1433/tcp
```

If needed, open the firewall for HTTP/HTTPS and SQL Server access.

---

## 11. Final check

From Ubuntu:

```bash
curl -k https://stms.local
curl -k https://stms.local/api/auth/login
```

From Windows browser:

```text
https://stms.local
```

This is the working deployment pattern used for this project.
