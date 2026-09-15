targetScope = 'resourceGroup'

@description('Globally unique Azure Container Registry name shared by both environments.')
param acrName string

@description('Registry SKU. Premium is required for geo-replication/private endpoints and is recommended for production.')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param acrSku string = 'Premium'

@description('Object ID of the environment deployment identity that may push release images.')
param ciPrincipalObjectId string = ''

@description('Azure region for the registry.')
param location string = resourceGroup().location

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: acrSku
  }
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    application: 'smart-task-management-system'
    managedBy: 'bicep'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
      trustPolicy: {
        status: 'disabled'
        type: 'Notary'
      }
    }
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: acrSku == 'Premium' ? 'Enabled' : 'Disabled'
  }
}

resource ciAcrPushRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(ciPrincipalObjectId)) {
  name: guid(registry.id, ciPrincipalObjectId, 'acr-push')
  scope: registry
  properties: {
    principalId: ciPrincipalObjectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')
  }
}

output registryId string = registry.id
output loginServer string = registry.properties.loginServer
