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
var nginxConfigBase64 = 'c2VydmVyIHsKICBsaXN0ZW4gODA7CiAgc2VydmVyX25hbWUgXzsKCiAgbG9jYXRpb24gLyB7CiAgICBwcm94eV9wYXNzIGh0dHA6Ly8xMjcuMC4wLjE6NTAwMC87CiAgICBwcm94eV9odHRwX3ZlcnNpb24gMS4xOwogICAgcHJveHlfc2V0X2hlYWRlciBIb3N0ICRob3N0OwogICAgcHJveHlfc2V0X2hlYWRlciBYLVJlYWwtSVAgJHJlbW90ZV9hZGRyOwogICAgcHJveHlfc2V0X2hlYWRlciBYLUZvcndhcmRlZC1Gb3IgJHByb3h5X2FkZF94X2ZvcndhcmRlZF9mb3I7CiAgICBwcm94eV9zZXRfaGVhZGVyIFgtRm9yd2FyZGVkLVByb3RvICRzY2hlbWU7CiAgfQp9'
var systemdUnitBase64 = 'W1VuaXRdCkRlc2NyaXB0aW9uPVNtYXJ0IFRhc2sgTWFuYWdlbWVudCBTeXN0ZW0gQVBJCkFmdGVyPW5ldHdvcmsudGFyZ2V0CgpbU2VydmljZV0KV29ya2luZ0RpcmVjdG9yeT0vdmFyL3d3dy9zdG1zLWFwaQpFeGVjU3RhcnQ9L3Vzci9iaW4vZG90bmV0IC92YXIvd3d3L3N0bXMtYXBpL0FwaS5kbGwKUmVzdGFydD1hbHdheXMKUmVzdGFydFNlYz01CkVudmlyb25tZW50RmlsZT0tL2V0Yy9zdG1zLWFwaS5lbnYKVXNlcj13d3ctZGF0YQpHcm91cD13d3ctZGF0YQoKW0luc3RhbGxdCldhbnRlZEJ5PW11bHRpLXVzZXIudGFyZ2V0'

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
      commandToExecute: 'apt-get update && apt-get install -y wget curl gnupg2 nginx unzip && curl -fsSL https://packages.microsoft.com/config/ubuntu/24.04/prod.list | tee /etc/apt/sources.list.d/microsoft-prod.list && apt-get update && apt-get install -y aspnetcore-runtime-10.0 && mkdir -p /var/www/stms-api && echo ${nginxConfigBase64} | base64 -d > /etc/nginx/sites-available/stms && ln -sf /etc/nginx/sites-available/stms /etc/nginx/sites-enabled/stms && rm -f /etc/nginx/sites-enabled/default && echo ${systemdUnitBase64} | base64 -d > /etc/systemd/system/stms-api.service && touch /etc/stms-api.env && chown www-data:www-data /var/www/stms-api /etc/stms-api.env && systemctl daemon-reload && systemctl enable nginx && systemctl restart nginx && systemctl enable stms-api'
    }
  }
}

output vmPublicIp string = publicIp.properties.ipAddress
output vmId string = vm.id
output vmName string = vm.name
