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


resource nsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
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


resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location

  properties: {

    addressSpace: {
      addressPrefixes: [
        '10.10.0.0/16'
      ]
    }

    subnets: [
      {
        name: subnetName

        properties: {
          addressPrefix: '10.10.1.0/24'

          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
}


resource publicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
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


resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: nicName
  location: location

  dependsOn: [
    vnet
  ]

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


resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
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

      windowsConfiguration: {

        provisionVMAgent: true

        enableAutomaticUpdates: true

        patchSettings: {
          patchMode: 'AutomaticByOS'
          assessmentMode: 'ImageDefault'
        }
      }
    }

    storageProfile: {

      imageReference: {
        publisher: 'MicrosoftWindowsServer'
        offer: 'windowsserver2022'
        sku: '2022-datacenter'
        version: 'latest'
      }

      osDisk: {

        createOption: 'FromImage'

        deleteOption: 'Delete'

        diskSizeGB: 64

        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
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

    diagnosticsProfile: {

      bootDiagnostics: {
        enabled: true
      }
    }
  }
}


output vmId string = vm.id
output vmName string = vm.name

output publicIpId string = publicIp.id
output publicIpName string = publicIp.name
