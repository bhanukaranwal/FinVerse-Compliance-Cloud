import { logger } from '../utils/logger';

export interface ESGScore {
  symbol: string;
  overall: number; // 0-100
  environmental: EnvironmentalScore;
  social: SocialScore;
  governance: GovernanceScore;
  lastUpdated: Date;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  controversies: Controversy[];
  trends: ESGTrend[];
  peerComparison: PeerComparison;
  sustainabilityMetrics: SustainabilityMetric[];
}

export interface EnvironmentalScore {
  score: number;
  carbonFootprint: number;
  waterUsage: number;
  wasteManagement: number;
  renewableEnergy: number;
  biodiversityImpact: number;
  climateChangeAdaptation: number;
  greenInnovation: number;
  environmentalCompliance: number;
}

export interface SocialScore {
  score: number;
  employeeWelfare: number;
  humanRights: number;
  communityImpact: number;
  productSafety: number;
  laborPractices: number;
  diversityInclusion: number;
  customerSatisfaction: number;
  socialInnovation: number;
}

export interface GovernanceScore {
  score: number;
  boardComposition: number;
  executiveCompensation: number;
  auditQuality: number;
  shareholderRights: number;
  transparency: number;
  ethicalBusiness: number;
  riskManagement: number;
  regulatoryCompliance: number;
}

export interface Controversy {
  id: string;
  title: string;
  description: string;
  category: 'ENVIRONMENTAL' | 'SOCIAL' | 'GOVERNANCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  date: Date;
  status: 'ONGOING' | 'RESOLVED' | 'MONITORING';
  impact: number; // Impact on ESG score
  sources: string[];
}

export interface ESGTrend {
  metric: string;
  direction: 'IMPROVING' | 'DECLINING' | 'STABLE';
  change: number;
  timeframe: string;
  significance: 'MINOR' | 'MODERATE' | 'SIGNIFICANT';
}

export interface PeerComparison {
  industry: string;
  sector: string;
  ranking: number;
  totalPeers: number;
  percentile: number;
  bestInClass: boolean;
  aboveMedian: boolean;
}

export interface SustainabilityMetric {
  name: string;
  value: number;
  unit: string;
  benchmark: number;
  target: number;
  progress: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
}

export interface ESGInvestmentRecommendation {
  symbol: string;
  esgScore: number;
  investment_rating: 'BUY' | 'HOLD' | 'SELL' | 'AVOID';
  esg_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  sustainable_score: number;
  impact_score: number;
  screening_results: ScreeningResult[];
  thematic_exposure: ThematicExposure[];
  carbon_intensity: number;
  water_intensity: number;
  waste_intensity: number;
  sdg_alignment: SDGAlignment[];
  green_revenue_percentage: number;
  controversies_summary: ControversiesSummary;
  engagement_opportunities: EngagementOpportunity[];
}

export interface ScreeningResult {
  type: 'NEGATIVE' | 'POSITIVE' | 'NORMS_BASED' | 'BEST_IN_CLASS';
  passed: boolean;
  reason: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ThematicExposure {
  theme: string;
  exposure: number; // Percentage
  revenue_alignment: number;
  growth_potential: number;
}

export interface SDGAlignment {
  goal: number; // UN SDG number 1-17
  title: string;
  alignment: number; // 0-100
  contribution: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  evidence: string[];
}

export interface ControversiesSummary {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recent: number; // Last 12 months
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface EngagementOpportunity {
  area: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  potential_impact: number;
  description: string;
  timeline: string;
}

export class ESGAnalyticsEngine {
  private esgData: Map<string, ESGScore> = new Map();
  private dataSources: ESGDataSource[] = [];

  constructor() {
    this.initializeDataSources();
  }

  async initialize(): Promise<void> {
    await this.loadESGData();
    this.startDataRefresh();
    logger.info('ESG Analytics Engine initialized');
  }

  private initializeDataSources(): void {
    this.dataSources = [
      new MSCIESGDataSource(),
      new SustainalyticsDataSource(),
      new BloombergESGDataSource(),
      new RefinitivESGDataSource(),
      new TruCostDataSource(),
      new IndianESGDataSource(), // Local Indian ESG data
    ];
  }

  async getESGScore(symbol: string): Promise<ESGScore> {
    let esgScore = this.esgData.get(symbol);
    
    if (!esgScore || this.isDataStale(esgScore)) {
      esgScore = await this.calculateESGScore(symbol);
      this.esgData.set(symbol, esgScore);
    }
    
    return esgScore;
  }

  private async calculateESGScore(symbol: string): Promise<ESGScore> {
    const [
      environmentalData,
      socialData,
      governanceData,
      controversies,
      peerData,
      sustainabilityData
    ] = await Promise.all([
      this.getEnvironmentalData(symbol),
      this.getSocialData(symbol),
      this.getGovernanceData(symbol),
      this.getControversies(symbol),
      this.getPeerData(symbol),
      this.getSustainabilityMetrics(symbol)
    ]);

    const environmental = this.calculateEnvironmentalScore(environmentalData);
    const social = this.calculateSocialScore(socialData);
    const governance = this.calculateGovernanceScore(governanceData);

    // Apply controversy penalties
    const controversyPenalty = this.calculateControversyPenalty(controversies);
    
    const overall = Math.max(0, (environmental.score + social.score + governance.score) / 3 - controversyPenalty);

    return {
      symbol,
      overall,
      environmental,
      social,
      governance,
      lastUpdated: new Date(),
      dataQuality: this.assessDataQuality(environmentalData, socialData, governanceData),
      controversies,
      trends: this.calculateTrends(symbol),
      peerComparison: this.calculatePeerComparison(symbol, overall, peerData),
      sustainabilityMetrics: sustainabilityData,
    };
  }

  async generateESGInvestmentRecommendation(symbol: string, investmentCriteria: ESGInvestmentCriteria): Promise<ESGInvestmentRecommendation> {
    const esgScore = await this.getESGScore(symbol);
    const companyData = await this.getCompanyData(symbol);
    
    const screeningResults = await this.performESGScreening(symbol, investmentCriteria);
    const thematicExposure = await this.calculateThematicExposure(symbol);
    const sdgAlignment = await this.calculateSDGAlignment(symbol);
    const carbonMetrics = await this.getCarbonMetrics(symbol);
    
    const investment_rating = this.determineESGRating(esgScore, screeningResults, investmentCriteria);
    const esg_risk_level = this.assessESGRisk(esgScore, screeningResults);
    
    return {
      symbol,
      esgScore: esgScore.overall,
      investment_rating,
      esg_risk_level,
      sustainable_score: this.calculateSustainabilityScore(esgScore, thematicExposure),
      impact_score: this.calculateImpactScore(sdgAlignment, thematicExposure),
      screening_results: screeningResults,
      thematic_exposure: thematicExposure,
      carbon_intensity: carbonMetrics.intensity,
      water_intensity: await this.getWaterIntensity(symbol),
      waste_intensity: await this.getWasteIntensity(symbol),
      sdg_alignment: sdgAlignment,
      green_revenue_percentage: await this.getGreenRevenuePercentage(symbol),
      controversies_summary: this.summarizeControversies(esgScore.controversies),
      engagement_opportunities: await this.identifyEngagementOpportunities(symbol, esgScore),
    };
  }

  async createESGPortfolioAnalysis(holdings: PortfolioHolding[]): Promise<ESGPortfolioAnalysis> {
    const esgScores = await Promise.all(
      holdings.map(holding => this.getESGScore(holding.symbol))
    );

    const weightedESGScore = this.calculateWeightedESGScore(holdings, esgScores);
    const carbonFootprint = await this.calculatePortfolioCarbonFootprint(holdings);
    const sectorAllocation = this.analyzeESGSectorAllocation(holdings, esgScores);
    const riskExposure = this.analyzeESGRiskExposure(holdings, esgScores);
    const improvementOpportunities = this.identifyPortfolioImprovementOpportunities(holdings, esgScores);
    
    return {
      totalValue: holdings.reduce((sum, h) => sum + h.marketValue, 0),
      weightedESGScore,
      carbonFootprint,
      sectorAllocation,
      riskExposure,
      topESGHoldings: this.getTopESGHoldings(holdings, esgScores, 10),
      bottomESGHoldings: this.getBottomESGHoldings(holdings, esgScores, 5),
      controversiesExposure: this.analyzeControversiesExposure(holdings, esgScores),
      thematicExposure: this.analyzePortfolioThematicExposure(holdings),
      sdgAlignment: this.analyzePortfolioSDGAlignment(holdings),
      improvementOpportunities,
      benchmarkComparison: await this.compareWithESGBenchmarks(holdings, esgScores),
      recommendations: this.generatePortfolioESGRecommendations(holdings, esgScores),
    };
  }

  async generateESGAlerts(symbol: string): Promise<ESGAlert[]> {
    const esgScore = await this.getESGScore(symbol);
    const alerts: ESGAlert[] = [];
    
    // Score decline alerts
    if (this.hasSignificantScoreDecline(symbol)) {
      alerts.push({
        id: `esg_decline_${symbol}_${Date.now()}`,
        type: 'SCORE_DECLINE',
        symbol,
        severity: 'MEDIUM',
        title: 'ESG Score Decline Detected',
        description: 'ESG score has declined significantly over the past quarter',
        category: 'PERFORMANCE',
        actionRequired: true,
        recommendations: ['Review recent company reports', 'Assess controversy impact'],
      });
    }
    
    // New controversy alerts
    const recentControversies = esgScore.controversies.filter(
      c => c.date > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    
    if (recentControversies.length > 0) {
      alerts.push({
        id: `esg_controversy_${symbol}_${Date.now()}`,
        type: 'NEW_CONTROVERSY',
        symbol,
        severity: this.getControversySeverity(recentControversies),
        title: 'New ESG Controversy Detected',
        description: `${recentControversies.length} new controversies identified`,
        category: 'RISK',
        actionRequired: true,
        recommendations: ['Evaluate investment thesis', 'Consider engagement'],
      });
    }
    
    // Regulatory compliance alerts
    if (esgScore.governance.regulatoryCompliance < 60) {
      alerts.push({
        id: `esg_compliance_${symbol}_${Date.now()}`,
        type: 'COMPLIANCE_RISK',
        symbol,
        severity: 'HIGH',
        title: 'Regulatory Compliance Risk',
        description: 'Low regulatory compliance score detected',
        category: 'GOVERNANCE',
        actionRequired: true,
        recommendations: ['Review regulatory filings', 'Assess compliance programs'],
      });
    }
    
    return alerts;
  }

  private async getEnvironmentalData(symbol: string): Promise<any> {
    const data = {};
    
    for (const source of this.dataSources) {
      try {
        const sourceData = await source.getEnvironmentalData(symbol);
        Object.assign(data, sourceData);
      } catch (error) {
        logger.warn(`Failed to get environmental data from ${source.name}:`, error);
      }
    }
    
    return data;
  }

  private calculateEnvironmentalScore(data: any): EnvironmentalScore {
    return {
      score: this.normalizeScore(data.environmental_score || 50),
      carbonFootprint: this.normalizeScore(100 - (data.carbon_intensity || 50)),
      waterUsage: this.normalizeScore(100 - (data.water_intensity || 50)),
      wasteManagement: this.normalizeScore(data.waste_management || 50),
      renewableEnergy: this.normalizeScore(data.renewable_energy || 30),
      biodiversityImpact: this.normalizeScore(100 - (data.biodiversity_impact || 30)),
      climateChangeAdaptation: this.normalizeScore(data.climate_adaptation || 40),
      greenInnovation: this.normalizeScore(data.green_innovation || 35),
      environmentalCompliance: this.normalizeScore(data.environmental_compliance || 70),
    };
  }

  private normalizeScore(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}

export interface ESGInvestmentCriteria {
  minimumESGScore: number;
  excludeSectors: string[];
  controversyTolerance: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  thematicFocus: string[];
  sdgAlignment: number[];
  carbonIntensityLimit: number;
  greenRevenueMinimum: number;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  marketValue: number;
  weight: number;
}

export interface ESGPortfolioAnalysis {
  totalValue: number;
  weightedESGScore: number;
  carbonFootprint: CarbonFootprint;
  sectorAllocation: SectorESGAllocation[];
  riskExposure: ESGRiskExposure;
  topESGHoldings: ESGHolding[];
  bottomESGHoldings: ESGHolding[];
  controversiesExposure: ControversiesExposure;
  thematicExposure: ThematicExposure[];
  sdgAlignment: SDGAlignment[];
  improvementOpportunities: ImprovementOpportunity[];
  benchmarkComparison: BenchmarkComparison;
  recommendations: ESGRecommendation[];
}

export interface ESGAlert {
  id: string;
  type: 'SCORE_DECLINE' | 'NEW_CONTROVERSY' | 'COMPLIANCE_RISK' | 'THEMATIC_OPPORTUNITY';
  symbol: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  category: 'ENVIRONMENTAL' | 'SOCIAL' | 'GOVERNANCE' | 'PERFORMANCE' | 'RISK';
  actionRequired: boolean;
  recommendations: string[];
}

interface ESGDataSource {
  name: string;
  getEnvironmentalData(symbol: string): Promise<any>;
  getSocialData(symbol: string): Promise<any>;
  getGovernanceData(symbol: string): Promise<any>;
  getControversies(symbol: string): Promise<Controversy[]>;
}

class IndianESGDataSource implements ESGDataSource {
  name = 'Indian ESG Data Source';
  
  async getEnvironmentalData(symbol: string): Promise<any> {
    // Fetch India-specific environmental data
    return {
      environmental_score: 65,
      carbon_intensity: 45,
      water_intensity: 40,
      waste_management: 55,
      renewable_energy: 35,
      pollution_control: 60,
      environmental_compliance: 75,
    };
  }
  
  async getSocialData(symbol: string): Promise<any> {
    return {
      social_score: 60,
      employee_welfare: 65,
      community_impact: 55,
      diversity_inclusion: 45,
      labor_practices: 70,
      product_safety: 80,
      customer_satisfaction: 75,
    };
  }
  
  async getGovernanceData(symbol: string): Promise<any> {
    return {
      governance_score: 70,
      board_composition: 65,
      transparency: 75,
      audit_quality: 80,
      shareholder_rights: 70,
      regulatory_compliance: 85,
      ethical_business: 65,
    };
  }
  
  async getControversies(symbol: string): Promise<Controversy[]> {
    // Fetch India-specific controversies
    return [];
  }
}