# FinVerse Compliance Cloud - Project Structure

finverse-compliance-cloud/
├── README.md
├── LICENSE
├── .gitignore
├── docker-compose.yml
├── package.json
├── lerna.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd.yml
│       └── security-scan.yml
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── deployment/
│   └── user-guides/
├── infrastructure/
│   ├── terraform/
│   ├── kubernetes/
│   └── helm/
├── services/
│   ├── api-gateway/
│   ├── user-management/
│   ├── broker-integration/
│   ├── tax-engine/
│   ├── compliance-engine/
│   ├── portfolio-service/
│   ├── document-service/
│   ├── audit-service/
│   ├── notification-service/
│   └── ai-service/
├── frontend/
│   ├── web-app/
│   ├── mobile-app/
│   └── shared-components/
├── shared/
│   ├── types/
│   ├── utils/
│   ├── constants/
│   └── database/
└── scripts/
    ├── setup.sh
    ├── deploy.sh
    └── test.sh