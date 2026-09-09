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
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: '10.0.1.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
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
            id: '${vnet.id}/subnets/${subnetName}'
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
        managedDisk: {
          storageAccountType: 'Standard_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

// Config file contents are pre-encoded as base64 to avoid shell-quoting issues
// with nginx's $variables and systemd unit syntax inside the extension command.
var nginxConfig = '''server {
  listen 80;
  server_name _;

  location / {
    proxy_pass http://127.0.0.1:5000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}'''

var systemdUnitConfig = '''[Unit]
Description=Smart Task Management System API
After=network.target

[Service]
WorkingDirectory=/var/www/stms-api
ExecStart=/usr/bin/dotnet /var/www/stms-api/Api.dll
Restart=always
RestartSec=5
EnvironmentFile=-/etc/stms-api.env
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target'''

var setupScript = '''#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends wget curl ca-certificates nginx unzip

curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
bash /tmp/dotnet-install.sh --channel 10.0 --runtime aspnetcore --install-dir /usr/share/dotnet
ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet

mkdir -p /var/www/stms-api
echo "$1" | base64 -d > /etc/nginx/sites-available/stms
ln -sf /etc/nginx/sites-available/stms /etc/nginx/sites-enabled/stms
rm -f /etc/nginx/sites-enabled/default

echo "$2" | base64 -d > /etc/systemd/system/stms-api.service
touch /etc/stms-api.env
chown www-data:www-data /var/www/stms-api /etc/stms-api.env

systemctl daemon-reload
systemctl enable nginx
systemctl restart nginx
systemctl enable stms-api
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
      commandToExecute: 'echo ${setupScriptBase64} | base64 -d > /tmp/setup.sh && bash /tmp/setup.sh "${nginxConfigBase64}" "${systemdUnitBase64}"'
    }
  }
}

output vmPublicIp string = publicIp.properties.ipAddress
output vmId string = vm.id
output vmName string = vm.name
