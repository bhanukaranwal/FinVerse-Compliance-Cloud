#!/bin/bash

# FinVerse Compliance Cloud Deployment Script

set -e

ENVIRONMENT=${1:-staging}
NAMESPACE="finverse-${ENVIRONMENT}"

echo "🚀 Deploying FinVerse Compliance Cloud to ${ENVIRONMENT}..."

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo "❌ helm is not installed"
    exit 1
fi

# Verify Kubernetes connection
echo "🔍 Verifying Kubernetes connection..."
kubectl cluster-info

# Create namespace if it doesn't exist
echo "📁 Creating namespace ${NAMESPACE}..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets
echo "🔐 Applying secrets..."
kubectl apply -f infrastructure/kubernetes/secrets/${ENVIRONMENT}/ -n ${NAMESPACE}

# Apply ConfigMaps
echo "🗂️  Applying ConfigMaps..."
kubectl apply -f infrastructure/kubernetes/configmaps/${ENVIRONMENT}/ -n ${NAMESPACE}

# Deploy infrastructure components
echo "🏗️  Deploying infrastructure components..."

# Deploy PostgreSQL
helm upgrade --install postgresql bitnami/postgresql \
  --namespace ${NAMESPACE} \
  --set auth.postgresPassword=${POSTGRES_PASSWORD} \
  --set auth.database=finverse_db \
  --set persistence.size=20Gi

# Deploy Redis
helm upgrade --install redis bitnami/redis \
  --namespace ${NAMESPACE} \
  --set auth.password=${REDIS_PASSWORD} \
  --set master.persistence.size=8Gi

# Deploy MongoDB
helm upgrade --install mongodb bitnami/mongodb \
  --namespace ${NAMESPACE} \
  --set auth.rootPassword=${MONGODB_PASSWORD} \
  --set persistence.size=20Gi

# Deploy Kafka
helm upgrade --install kafka bitnami/kafka \
  --namespace ${NAMESPACE} \
  --set persistence.size=8Gi

# Wait for infrastructure to be ready
echo "⏳ Waiting for infrastructure to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgresql -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n ${NAMESPACE} --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=mongodb -n ${NAMESPACE} --timeout=300s

# Deploy application services
echo "🚀 Deploying application services..."
kubectl apply -f infrastructure/kubernetes/${ENVIRONMENT}/ -n ${NAMESPACE}

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available deployment --all -n ${NAMESPACE} --timeout=600s

# Run database migrations
echo "🗄️  Running database migrations..."
kubectl run migration-job --image=finverse/database-migrator:latest \
  --env="DATABASE_URL=${DATABASE_URL}" \
  --restart=Never \
  -n ${NAMESPACE}

kubectl wait --for=condition=complete job/migration-job -n ${NAMESPACE} --timeout=300s
kubectl delete job migration-job -n ${NAMESPACE}

# Verify deployment
echo "✅ Verifying deployment..."
kubectl get pods -n ${NAMESPACE}
kubectl get services -n ${NAMESPACE}
kubectl get ingress -n ${NAMESPACE}

echo "🎉 Deployment to ${ENVIRONMENT} completed successfully!"

if [ "${ENVIRONMENT}" = "production" ]; then
    echo "🔔 Production deployment completed. Please verify:"
    echo "  - All services are running"
    echo "  - Health checks are passing"
    echo "  - SSL certificates are valid"
    echo "  - Monitoring alerts are configured"
fi