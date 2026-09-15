{{- define "stms.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "stms.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "stms.labels" -}}
app.kubernetes.io/name: {{ include "stms.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: stms
app.kubernetes.io/environment: {{ .Values.environment | quote }}
{{- end -}}

{{- define "stms.selectorLabels" -}}
app.kubernetes.io/name: {{ include "stms.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "stms.image" -}}
{{- if .digest -}}
{{ .repository }}@{{ .digest }}
{{- else -}}
{{ .repository }}:{{ .tag }}
{{- end -}}
{{- end -}}

{{- define "stms.secretVolume" -}}
- name: keyvault-secrets
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: {{ include "stms.fullname" . | quote }}
{{- end -}}

{{- define "stms.runtimeSecretVolume" -}}
- name: keyvault-secrets
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: {{ printf "%s-runtime" (include "stms.fullname" .) | quote }}
{{- end -}}

{{- define "stms.adminSecretVolume" -}}
- name: keyvault-secrets
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: {{ printf "%s-admin" (include "stms.fullname" .) | quote }}
{{- end -}}

{{- define "stms.secretMount" -}}
- name: keyvault-secrets
  mountPath: {{ .Values.keyVault.mountPath }}
  readOnly: true
{{- end -}}

{{- define "stms.commonPodMetadata" -}}
{{- include "stms.selectorLabels" . }}
{{- end -}}
