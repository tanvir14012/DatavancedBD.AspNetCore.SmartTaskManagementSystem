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

// Config file contents are readable as Bicep multi-line strings
// Bicep's base64() function encodes them automatically
var nginxConfig = 'server {\n  listen 80;\n  server_name _;\n\n  location / {\n    proxy_pass http://127.0.0.1:5000/;\n    proxy_http_version 1.1;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n  }\n}'

var nginxConfigBase64 = base64(nginxConfig)

var systemdUnitConfig = '[Unit]\nDescription=Smart Task Management System API\nAfter=network.target\n\n[Service]\nWorkingDirectory=/var/www/stms-api\nExecStart=/usr/bin/dotnet /var/www/stms-api/Api.dll\nRestart=always\nRestartSec=5\nEnvironmentFile=-/etc/stms-api.env\nUser=www-data\nGroup=www-data\n\n[Install]\nWantedBy=multi-user.target'

var systemdUnitBase64 = base64(systemdUnitConfig)

var setupScript = '''#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

# Update package lists
apt-get update
apt-get install -y --no-install-recommends wget curl gnupg ca-certificates nginx unzip

# Add Microsoft package repository
ARCH=$(dpkg --print-architecture)
mkdir -p /etc/apt/keyrings
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /etc/apt/keyrings/microsoft-prod.gpg
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/ubuntu/24.04/prod stable main" > /etc/apt/sources.list.d/microsoft-prod.list

# Install .NET runtime
apt-get update
apt-get install -y --no-install-recommends aspnetcore-runtime-10.0

# Create app directory and configure nginx
mkdir -p /var/www/stms-api
echo "$1" | base64 -d > /etc/nginx/sites-available/stms
ln -sf /etc/nginx/sites-available/stms /etc/nginx/sites-enabled/stms
rm -f /etc/nginx/sites-enabled/default

# Configure systemd service
echo "$2" | base64 -d > /etc/systemd/system/stms-api.service

# Setup permissions and environment file
touch /etc/stms-api.env
chown www-data:www-data /var/www/stms-api /etc/stms-api.env

# Enable services
systemctl daemon-reload
systemctl enable nginx
systemctl restart nginx
systemctl enable stms-api
'''

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
