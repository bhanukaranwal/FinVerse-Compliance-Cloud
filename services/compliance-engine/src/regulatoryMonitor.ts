import axios from 'axios';
import cheerio from 'cheerio';
import { RuleEngine } from './ruleEngine';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

export interface RegulatoryUpdate {
  id: string;
  source: 'SEBI' | 'RBI' | 'CBDT' | 'GST_COUNCIL' | 'MCA';
  title: string;
  description: string;
  category: string;
  effectiveDate: Date;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedAreas: string[];
  documentUrl: string;
  summary: string;
  actionItems: string[];
  implementationDeadline?: Date;
  isProcessed: boolean;
  createdAt: Date;
}

export interface ComplianceGap {
  ruleId: string;
  description: string;
  currentState: string;
  requiredState: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  remediation: {
    steps: string[];
    estimatedTime: number;
    resources: string[];
  };
  dueDate: Date;
}

export class RegulatoryMonitoringService {
  private ruleEngine: RuleEngine;
  private notificationService: NotificationService;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.ruleEngine = new RuleEngine();
    this.notificationService = new NotificationService();
  }

  async startMonitoring() {
    logger.info('Starting regulatory monitoring service');
    
    // Check for updates every 4 hours
    this.monitoringInterval = setInterval(async () => {
      await this.checkForRegulatoryUpdates();
    }, 4 * 60 * 60 * 1000);

    // Initial check
    await this.checkForRegulatoryUpdates();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('Stopped regulatory monitoring service');
  }

  private async checkForRegulatoryUpdates() {
    try {
      const updates = await Promise.all([
        this.checkSEBIUpdates(),
        this.checkRBIUpdates(),
        this.checkCBDTUpdates(),
        this.checkGSTUpdates(),
        this.checkMCAUpdates(),
      ]);

      const allUpdates = updates.flat();
      
      for (const update of allUpdates) {
        await this.processRegulatoryUpdate(update);
      }

      logger.info(`Processed ${allUpdates.length} regulatory updates`);
    } catch (error) {
      logger.error('Error checking regulatory updates:', error);
    }
  }

  private async checkSEBIUpdates(): Promise<RegulatoryUpdate[]> {
    try {
      const response = await axios.get('https://www.sebi.gov.in/legal/circulars');
      const $ = cheerio.load(response.data);
      const updates: RegulatoryUpdate[] = [];

      $('.circular-item').each((index, element) => {
        const title = $(element).find('.title').text().trim();
        const date = $(element).find('.date').text().trim();
        const link = $(element).find('a').attr('href');

        if (this.isRecentUpdate(date)) {
          updates.push({
            id: `sebi-${Date.now()}-${index}`,
            source: 'SEBI',
            title,
            description: title,
            category: this.categorizeUpdate(title),
            effectiveDate: new Date(date),
            impactLevel: this.assessImpactLevel(title),
            affectedAreas: this.identifyAffectedAreas(title),
            documentUrl: `https://www.sebi.gov.in${link}`,
            summary: '',
            actionItems: [],
            isProcessed: false,
            createdAt: new Date(),
          });
        }
      });

      return updates;
    } catch (error) {
      logger.error('Error checking SEBI updates:', error);
      return [];
    }
  }

  private async checkRBIUpdates(): Promise<RegulatoryUpdate[]> {
    try {
      const response = await axios.get('https://www.rbi.org.in/Scripts/NotificationUser.aspx');
      const $ = cheerio.load(response.data);
      const updates: RegulatoryUpdate[] = [];

      $('.tablebg tr').each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length >= 3) {
          const date = $(cells[0]).text().trim();
          const title = $(cells[1]).text().trim();
          const link = $(cells[1]).find('a').attr('href');

          if (this.isRecentUpdate(date) && this.isRelevantToTrading(title)) {
            updates.push({
              id: `rbi-${Date.now()}-${index}`,
              source: 'RBI',
              title,
              description: title,
              category: this.categorizeUpdate(title),
              effectiveDate: new Date(date),
              impactLevel: this.assessImpactLevel(title),
              affectedAreas: this.identifyAffectedAreas(title),
              documentUrl: link ? `https://www.rbi.org.in${link}` : '',
              summary: '',
              actionItems: [],
              isProcessed: false,
              createdAt: new Date(),
            });
          }
        }
      });

      return updates;
    } catch (error) {
      logger.error('Error checking RBI updates:', error);
      return [];
    }
  }

  private async checkCBDTUpdates(): Promise<RegulatoryUpdate[]> {
    try {
      const response = await axios.get('https://www.incometax.gov.in/iec/foportal/help/notifications');
      const $ = cheerio.load(response.data);
      const updates: RegulatoryUpdate[] = [];

      $('.notification-item').each((index, element) => {
        const title = $(element).find('.notification-title').text().trim();
        const date = $(element).find('.notification-date').text().trim();
        const link = $(element).find('a').attr('href');

        if (this.isRecentUpdate(date)) {
          updates.push({
            id: `cbdt-${Date.now()}-${index}`,
            source: 'CBDT',
            title,
            description: title,
            category: this.categorizeUpdate(title),
            effectiveDate: new Date(date),
            impactLevel: this.assessImpactLevel(title),
            affectedAreas: this.identifyAffectedAreas(title),
            documentUrl: link || '',
            summary: '',
            actionItems: [],
            isProcessed: false,
            createdAt: new Date(),
          });
        }
      });

      return updates;
    } catch (error) {
      logger.error('Error checking CBDT updates:', error);
      return [];
    }
  }

  private async processRegulatoryUpdate(update: RegulatoryUpdate) {
    try {
      // Extract full content from the document
      const content = await this.extractDocumentContent(update.documentUrl);
      
      // Use AI to analyze the content
      const analysis = await this.analyzeRegulatoryContent(content);
      
      update.summary = analysis.summary;
      update.actionItems = analysis.actionItems;
      update.implementationDeadline = analysis.implementationDeadline;

      // Update compliance rules if necessary
      if (update.impactLevel === 'HIGH' || update.impactLevel === 'CRITICAL') {
        await this.updateComplianceRules(update);
      }

      // Send notifications based on impact level
      await this.sendNotifications(update);

      // Store the update
      await this.storeRegulatoryUpdate(update);

      logger.info(`Processed regulatory update: ${update.title}`);
    } catch (error) {
      logger.error(`Error processing regulatory update ${update.id}:`, error);
    }
  }

  private async analyzeRegulatoryContent(content: string) {
    // This would use NLP/AI to analyze the regulatory content
    // For now, using rule-based analysis
    
    const summary = this.generateSummary(content);
    const actionItems = this.extractActionItems(content);
    const implementationDeadline = this.extractDeadline(content);

    return {
      summary,
      actionItems,
      implementationDeadline,
    };
  }

  private generateSummary(content: string): string {
    // Extract key points from the document
    const sentences = content.split('. ');
    const keyWords = ['shall', 'must', 'required', 'mandatory', 'effective', 'compliance'];
    
    const keySentences = sentences.filter(sentence => 
      keyWords.some(word => sentence.toLowerCase().includes(word))
    );

    return keySentences.slice(0, 3).join('. ') + '.';
  }

  private extractActionItems(content: string): string[] {
    const actionItems: string[] = [];
    const actionPatterns = [
      /shall\s+([^.]+)/gi,
      /must\s+([^.]+)/gi,
      /required\s+to\s+([^.]+)/gi,
      /mandatory\s+([^.]+)/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        actionItems.push(...matches.map(match => match.trim()));
      }
    }

    return [...new Set(actionItems)].slice(0, 10); // Remove duplicates and limit
  }

  private extractDeadline(content: string): Date | undefined {
    const datePatterns = [
      /effective\s+from\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /with\s+effect\s+from\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /deadline\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        return new Date(match[1]);
      }
    }

    return undefined;
  }

  async performComplianceAudit(userId: string): Promise<{
    overallScore: number;
    gaps: ComplianceGap[];
    recommendations: string[];
    nextAuditDate: Date;
  }> {
    const gaps = await this.identifyComplianceGaps(userId);
    const overallScore = this.calculateComplianceScore(gaps);
    const recommendations = this.generateRecommendations(gaps);
    const nextAuditDate = new Date();
    nextAuditDate.setMonth(nextAuditDate.getMonth() + 3); // Quarterly audits

    return {
      overallScore,
      gaps,
      recommendations,
      nextAuditDate,
    };
  }

  private async identifyComplianceGaps(userId: string): Promise<ComplianceGap[]> {
    const gaps: ComplianceGap[] = [];
    
    // Check various compliance areas
    const checks = [
      this.checkTaxComplianceGaps(userId),
      this.checkTradingComplianceGaps(userId),
      this.checkDocumentationGaps(userId),
      this.checkReportingGaps(userId),
    ];

    const results = await Promise.all(checks);
    return results.flat();
  }

  private async checkTaxComplianceGaps(userId: string): Promise<ComplianceGap[]> {
    const gaps: ComplianceGap[] = [];
    
    // Check if ITR filing is up to date
    const lastFilingDate = await this.getLastITRFilingDate(userId);
    const currentFY = this.getCurrentFinancialYear();
    
    if (!lastFilingDate || lastFilingDate < new Date(currentFY.endDate)) {
      gaps.push({
        ruleId: 'ITR_FILING',
        description: 'Income Tax Return filing is overdue',
        currentState: 'Not filed for current FY',
        requiredState: 'Filed within due date',
        priority: 'HIGH',
        remediation: {
          steps: [
            'Gather all investment and trading documents',
            'Calculate capital gains and losses',
            'Prepare ITR-2 form',
            'File return online or through CA',
          ],
          estimatedTime: 5, // days
          resources: ['Tax consultant', 'Trading documents', 'Bank statements'],
        },
        dueDate: new Date(currentFY.dueDate),
      });
    }

    return gaps;
  }

  // Helper methods
  private isRecentUpdate(dateString: string): boolean {
    const updateDate = new Date(dateString);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return updateDate > thirtyDaysAgo;
  }

  private isRelevantToTrading(title: string): boolean {
    const relevantKeywords = [
      'trading', 'investment', 'securities', 'market', 'broker',
      'capital', 'equity', 'derivative', 'mutual fund', 'tax'
    ];
    return relevantKeywords.some(keyword => 
      title.toLowerCase().includes(keyword)
    );
  }

  private categorizeUpdate(title: string): string {
    if (title.toLowerCase().includes('tax')) return 'TAX';
    if (title.toLowerCase().includes('trading')) return 'TRADING';
    if (title.toLowerCase().includes('disclosure')) return 'DISCLOSURE';
    if (title.toLowerCase().includes('kyc')) return 'KYC';
    return 'GENERAL';
  }

  private assessImpactLevel(title: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const highImpactWords = ['mandatory', 'penalty', 'prohibition', 'suspension'];
    const criticalWords = ['immediate', 'urgent', 'critical', 'emergency'];
    
    if (criticalWords.some(word => title.toLowerCase().includes(word))) {
      return 'CRITICAL';
    }
    if (highImpactWords.some(word => title.toLowerCase().includes(word))) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  private identifyAffectedAreas(title: string): string[] {
    const areas: string[] = [];
    
    if (title.toLowerCase().includes('tax')) areas.push('TAX_FILING');
    if (title.toLowerCase().includes('trading')) areas.push('TRADING_OPERATIONS');
    if (title.toLowerCase().includes('reporting')) areas.push('REGULATORY_REPORTING');
    if (title.toLowerCase().includes('disclosure')) areas.push('DISCLOSURE_REQUIREMENTS');
    
    return areas;
  }
}