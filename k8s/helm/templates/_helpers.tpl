{{/*
Expand the name of the chart.
*/}}
{{- define "trading-bot.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "trading-bot.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "trading-bot.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "trading-bot.labels" -}}
helm.sh/chart: {{ include "trading-bot.chart" . }}
{{ include "trading-bot.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "trading-bot.selectorLabels" -}}
app.kubernetes.io/name: {{ include "trading-bot.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "trading-bot.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "trading-bot.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL host
*/}}
{{- define "trading-bot.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "trading-bot.fullname" .) }}
{{- else }}
{{- .Values.externalPostgresql.host }}
{{- end }}
{{- end }}

{{/*
Redis host
*/}}
{{- define "trading-bot.redis.host" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "trading-bot.fullname" .) }}
{{- else }}
{{- .Values.externalRedis.host }}
{{- end }}
{{- end }}

{{/*
RabbitMQ host
*/}}
{{- define "trading-bot.rabbitmq.host" -}}
{{- if .Values.rabbitmq.enabled }}
{{- printf "%s-rabbitmq" (include "trading-bot.fullname" .) }}
{{- else }}
{{- .Values.externalRabbitmq.host }}
{{- end }}
{{- end }}

{{/*
Environment-specific values
*/}}
{{- define "trading-bot.environment.values" -}}
{{- $environment := .Values.global.environment | default "production" }}
{{- if hasKey .Values.environments $environment }}
{{- index .Values.environments $environment }}
{{- else }}
{{- dict }}
{{- end }}
{{- end }}

{{/*
Merge environment-specific values
*/}}
{{- define "trading-bot.mergeValues" -}}
{{- $base := .base }}
{{- $env := include "trading-bot.environment.values" . | fromYaml }}
{{- if $env }}
{{- $merged := mergeOverwrite $base $env }}
{{- toYaml $merged }}
{{- else }}
{{- toYaml $base }}
{{- end }}
{{- end }}