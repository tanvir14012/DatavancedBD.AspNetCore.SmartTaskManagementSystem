param location string
param vmName string
param vmSize string
param adminUsername string

@secure()
param adminPassword string

param vnetName string
param subnetName string
param nsgName string
param publicIpName string
param nicName string

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: nsgName
  location: location

  properties: {
    flushConnection: false
    securityRules: [
      {
        name: 'AllowHTTP'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 100
          direction: 'Inbound'
        }
      }
      {
        name: 'AllowHTTPS'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 110
          direction: 'Inbound'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
  }
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' = {
  parent: vnet
  name: subnetName

  properties: {
    addressPrefix: '10.0.1.0/24'

    networkSecurityGroup: {
      id: nsg.id
    }
  }
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: publicIpName
  location: location

  sku: {
    name: 'Standard'
  }

  properties: {
    publicIPAllocationMethod: 'Static'
    idleTimeoutInMinutes: 4
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {
  name: nicName
  location: location

  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'

        properties: {
          subnet: {
            id: resourceId(
              'Microsoft.Network/virtualNetworks/subnets',
              vnetName,
              subnetName
            )
          }

          privateIPAllocationMethod: 'Dynamic'

          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2023-09-01' = {
  name: vmName
  location: location

  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }

    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      adminPassword: adminPassword

      linuxConfiguration: {
        disablePasswordAuthentication: false
      }
    }

    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }

      osDisk: {
        createOption: 'FromImage'

        deleteOption: 'Delete'

        managedDisk: {
          storageAccountType: 'Standard_LRS'
        }
      }
    }

    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
          properties: {
            deleteOption: 'Delete'
          }
        }
      ]
    }
  }
}

// Config file contents are pre-encoded as base64 to avoid shell-quoting issues
// with nginx's $variables and systemd unit syntax inside the extension command.

var nginxConfig = '''
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
'''

var systemdUnitConfig = '''
[Unit]
Description=Smart Task Management System API
After=network.target

[Service]
WorkingDirectory=/var/www/stms-api
ExecStart=/usr/bin/dotnet /var/www/stms-api/Api.dll
Restart=always
RestartSec=5
User=www-data
Group=www-data
EnvironmentFile=-/etc/stms-api.env

[Install]
WantedBy=multi-user.target
'''

var setupScript = '''
#!/bin/bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

rm -f /etc/apt/sources.list.d/microsoft-prod.list
rm -f /etc/apt/sources.list.d/azure-cli.list

apt-get update

apt-get install -y \
    wget \
    curl \
    unzip \
    nginx \
    ca-certificates

curl -fsSL https://dot.net/v1/dotnet-install.sh \
    -o /tmp/dotnet-install.sh

chmod +x /tmp/dotnet-install.sh

bash /tmp/dotnet-install.sh \
    --channel 10.0 \
    --runtime aspnetcore \
    --install-dir /usr/share/dotnet

ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet

mkdir -p /var/www/stms-api

echo "$1" | base64 -d > /etc/nginx/sites-available/stms

ln -sf \
    /etc/nginx/sites-available/stms \
    /etc/nginx/sites-enabled/stms

rm -f /etc/nginx/sites-enabled/default

echo "$2" | base64 -d > /etc/systemd/system/stms-api.service

touch /etc/stms-api.env

chown -R www-data:www-data /var/www/stms-api
chown www-data:www-data /etc/stms-api.env

systemctl daemon-reload

systemctl enable nginx
systemctl restart nginx

systemctl enable stms-api

# Won't fail deployment if the DLL hasn't been deployed yet.
systemctl restart stms-api || true

systemctl status nginx --no-pager || true
systemctl status stms-api --no-pager || true
'''

var nginxConfigBase64 = base64(nginxConfig)
var systemdUnitBase64 = base64(systemdUnitConfig)
var setupScriptBase64 = base64(setupScript)

resource vmCustomScript 'Microsoft.Compute/virtualMachines/extensions@2023-09-01' = {
  parent: vm
  name: 'setup-nginx-dotnet'
  location: location

  properties: {
    publisher: 'Microsoft.Azure.Extensions'
    type: 'CustomScript'
    typeHandlerVersion: '2.1'
    autoUpgradeMinorVersion: true

    settings: {
      commandToExecute: 'echo "${setupScriptBase64}" | base64 -d > /tmp/setup.sh && chmod +x /tmp/setup.sh && /tmp/setup.sh "${nginxConfigBase64}" "${systemdUnitBase64}"'
    }
  }
}

output publicIpId string = publicIp.id
output publicIpName string = publicIp.name
output vmId string = vm.id
output vmName string = vm.name
