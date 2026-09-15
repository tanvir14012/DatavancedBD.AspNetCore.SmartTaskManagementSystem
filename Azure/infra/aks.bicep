targetScope = 'resourceGroup'

@description('Deployment environment.')
@allowed([
  'dev'
  'prod'
])
param environment string

param location string = resourceGroup().location
param clusterName string
param acrName string
param acrResourceGroupName string
param keyVaultName string
param logAnalyticsName string
param namespace string = 'stms'
param releaseName string = 'stms'

@description('The object ID of the environment deployment identity. Leave empty only for a manually bootstrapped cluster.')
param ciPrincipalObjectId string = ''

@description('Optional Entra group object IDs allowed to administer the AKS control plane.')
param adminGroupObjectIds array = []

@description('Public API server allowlist. Keep this restricted to build agents and approved operator egress IPs.')
param authorizedApiServerIpRanges array = []

param kubernetesVersion string = ''
param nodeVmSize string = environment == 'prod' ? 'Standard_D4ds_v5' : 'Standard_D2ds_v5'
param nodeAvailabilityZones array = environment == 'prod' ? ['1', '2', '3'] : []
param systemNodeMinCount int = environment == 'prod' ? 2 : 1
param systemNodeMaxCount int = environment == 'prod' ? 4 : 3
param userNodeMinCount int = environment == 'prod' ? 2 : 1
param userNodeMaxCount int = environment == 'prod' ? 8 : 4
param vnetName string = 'stms-${environment}-vnet'
param subnetName string = 'stms-${environment}-aks'
param vnetAddressPrefix string = environment == 'prod' ? '10.40.0.0/16' : '10.30.0.0/16'
param aksSubnetPrefix string = environment == 'prod' ? '10.40.0.0/20' : '10.30.0.0/20'
param podCidr string = environment == 'prod' ? '10.244.0.0/16' : '10.245.0.0/16'
param serviceCidr string = environment == 'prod' ? '10.0.0.0/16' : '10.1.0.0/16'
param dnsServiceIp string = environment == 'prod' ? '10.0.0.10' : '10.1.0.10'
param enablePurgeProtection bool = environment == 'prod'
param logRetentionDays int = environment == 'prod' ? 90 : 30

var tags = {
  application: 'smart-task-management-system'
  environment: environment
  managedBy: 'bicep'
}
var acrPullRoleDefinitionId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var keyVaultSecretsUserRoleDefinitionId = '4633458b-17de-408a-b874-0445c86b69e6'
var keyVaultSecretsOfficerRoleDefinitionId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
var aksClusterUserRoleDefinitionId = '4abbcc35-e782-43d8-92c5-2d3f1bd2253f'
var aksRbacClusterAdminRoleDefinitionId = 'b1ff04bb-8a4e-4dc4-8eb5-8693973ce19b'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    retentionInDays: logRetentionDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'stms-${environment}-appinsights'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    DisableIpMasking: false
    RetentionInDays: logRetentionDays
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
  }
}

resource aksSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' = {
  parent: vnet
  name: subnetName
  properties: {
    addressPrefix: aksSubnetPrefix
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: enablePurgeProtection
    publicNetworkAccess: 'Enabled'
  }
}

resource runtimeIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'stms-${environment}-runtime'
  location: location
  tags: tags
}

resource adminIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'stms-${environment}-admin'
  location: location
  tags: tags
}

resource aks 'Microsoft.ContainerService/managedClusters@2024-10-01' = {
  name: clusterName
  location: location
  tags: tags
  sku: {
    name: 'Base'
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    kubernetesVersion: empty(kubernetesVersion) ? null : kubernetesVersion
    dnsPrefix: '${clusterName}-dns'
    autoUpgradeProfile: {
      upgradeChannel: 'stable'
      nodeOSUpgradeChannel: 'NodeImage'
    }
    disableLocalAccounts: true
    enableRBAC: true
    aadProfile: {
      managed: true
      enableAzureRBAC: true
      adminGroupObjectIDs: adminGroupObjectIds
      tenantID: subscription().tenantId
    }
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
    addonProfiles: {
      azureKeyvaultSecretsProvider: {
        enabled: true
        config: {
          enableSecretRotation: 'true'
          rotationPollInterval: '2m'
        }
      }
      webAppRouting: {
        enabled: true
      }
      omsAgent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
          useAADAuth: 'true'
        }
      }
    }
    agentPoolProfiles: [
      {
        name: 'system'
        mode: 'System'
        count: systemNodeMinCount
        vmSize: nodeVmSize
        osType: 'Linux'
        osSKU: 'AzureLinux'
        type: 'VirtualMachineScaleSets'
        enableAutoScaling: true
        minCount: systemNodeMinCount
        maxCount: systemNodeMaxCount
        maxPods: 50
        availabilityZones: nodeAvailabilityZones
        vnetSubnetID: aksSubnet.id
        nodeLabels: {
          'workload.stms/type': 'system'
        }
      }
      {
        name: 'user'
        mode: 'User'
        count: userNodeMinCount
        vmSize: nodeVmSize
        osType: 'Linux'
        osSKU: 'AzureLinux'
        type: 'VirtualMachineScaleSets'
        enableAutoScaling: true
        minCount: userNodeMinCount
        maxCount: userNodeMaxCount
        maxPods: 50
        availabilityZones: nodeAvailabilityZones
        vnetSubnetID: aksSubnet.id
        nodeLabels: {
          'workload.stms/type': 'application'
        }
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      networkPolicy: 'azure'
      podCidr: podCidr
      serviceCidr: serviceCidr
      dnsServiceIP: dnsServiceIp
      loadBalancerSku: 'standard'
      outboundType: 'loadBalancer'
      loadBalancerProfile: {
        managedOutboundIPs: {
          count: 1
        }
      }
    }
    apiServerAccessProfile: {
      enablePrivateCluster: false
      authorizedIPRanges: authorizedApiServerIpRanges
    }
    autoScalerProfile: {
      balanceSimilarNodeGroups: 'true'
      expander: 'least-waste'
      maxEmptyBulkDelete: '10'
      maxGracefulTerminationSec: '600'
      maxNodeProvisionTime: '15m'
      maxTotalUnreadyPercentage: '45'
      newPodScaleUpDelay: '0s'
      okTotalUnreadyCount: '3'
      scaleDownDelayAfterAdd: '10m'
      scaleDownDelayAfterDelete: '10s'
      scaleDownDelayAfterFailure: '3m'
      scaleDownUnneededTime: '10m'
      scaleDownUnreadyTime: '20m'
      scanInterval: '10s'
      skipNodesWithLocalStorage: 'false'
      skipNodesWithSystemPods: 'true'
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
  scope: resourceGroup(acrResourceGroupName)
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, aks.id, 'acr-pull')
  scope: acr
  dependsOn: [aks]
  properties: {
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
  }
}

resource runtimeSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, runtimeIdentity.id, 'secrets-user')
  scope: keyVault
  properties: {
    principalId: runtimeIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
  }
}

resource adminSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, adminIdentity.id, 'secrets-user')
  scope: keyVault
  properties: {
    principalId: adminIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
  }
}

resource ciSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(ciPrincipalObjectId)) {
  name: guid(keyVault.id, ciPrincipalObjectId, 'secrets-officer')
  scope: keyVault
  properties: {
    principalId: ciPrincipalObjectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsOfficerRoleDefinitionId)
  }
}

resource ciClusterUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(ciPrincipalObjectId)) {
  name: guid(aks.id, ciPrincipalObjectId, 'cluster-user')
  scope: aks
  properties: {
    principalId: ciPrincipalObjectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aksClusterUserRoleDefinitionId)
  }
}

resource ciKubernetesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(ciPrincipalObjectId)) {
  name: guid(aks.id, ciPrincipalObjectId, 'kubernetes-cluster-admin')
  scope: aks
  properties: {
    principalId: ciPrincipalObjectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aksRbacClusterAdminRoleDefinitionId)
  }
}

resource runtimeApiFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: runtimeIdentity
  name: 'api'
  properties: {
    audiences: ['api://AzureADTokenExchange']
    issuer: aks.properties.oidcIssuerProfile.issuerUrl
    subject: 'system:serviceaccount:${namespace}:${releaseName}-api'
  }
}

resource runtimeWorkerFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: runtimeIdentity
  name: 'worker'
  properties: {
    audiences: ['api://AzureADTokenExchange']
    issuer: aks.properties.oidcIssuerProfile.issuerUrl
    subject: 'system:serviceaccount:${namespace}:${releaseName}-worker'
  }
}

resource adminFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: adminIdentity
  name: 'admin'
  properties: {
    audiences: ['api://AzureADTokenExchange']
    issuer: aks.properties.oidcIssuerProfile.issuerUrl
    subject: 'system:serviceaccount:${namespace}:${releaseName}-admin'
  }
}

output clusterId string = aks.id
output clusterName string = aks.name
output keyVaultUri string = keyVault.properties.vaultUri
output runtimeClientId string = runtimeIdentity.properties.clientId
output adminClientId string = adminIdentity.properties.clientId
output oidcIssuerUrl string = aks.properties.oidcIssuerProfile.issuerUrl
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
