import Tesseract from 'tesseract.js';
import { PDFExtract } from 'pdf.js-extract';
import { Document, ProcessingStatus } from '@finverse/shared-types';
import { logger } from '../utils/logger';

export interface ExtractedData {
  trades: Array<{
    date: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    amount: number;
    charges: {
      brokerage?: number;
      stt?: number;
      gst?: number;
    };
  }>;
  bankTransactions: Array<{
    date: string;
    description: string;
    debit?: number;
    credit?: number;
    balance: number;
  }>;
  portfolioHoldings: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    value: number;
  }>;
  taxDocuments: Array<{
    documentType: string;
    assessmentYear: string;
    totalIncome: number;
    taxPaid: number;
    refund?: number;
  }>;
  metadata: {
    documentType: string;
    broker?: string;
    accountNumber?: string;
    period?: {
      from: string;
      to: string;
    };
    confidence: number;
  };
}

export class IntelligentDocumentProcessor {
  private pdfExtractor: PDFExtract;

  constructor() {
    this.pdfExtractor = new PDFExtract();
  }

  async processDocument(document: Document): Promise<ExtractedData> {
    logger.info(`Processing document: ${document.name}`);

    try {
      let text = '';
      let confidence = 0;

      // Extract text based on document type
      if (document.mimeType === 'application/pdf') {
        const result = await this.extractFromPDF(document.path);
        text = result.text;
        confidence = result.confidence;
      } else if (document.mimeType.startsWith('image/')) {
        const result = await this.extractFromImage(document.path);
        text = result.text;
        confidence = result.confidence;
      } else {
        throw new Error(`Unsupported document type: ${document.mimeType}`);
      }

      // Update document with extracted text
      document.metadata.extractedText = text;
      document.metadata.ocrConfidence = confidence;

      // Analyze and extract structured data
      const extractedData = await this.analyzeAndExtractData(text, document);

      // Update processing status
      document.metadata.processingStatus = ProcessingStatus.COMPLETED;
      document.metadata.extractedData = extractedData;

      return extractedData;
    } catch (error) {
      logger.error(`Error processing document ${document.id}:`, error);
      document.metadata.processingStatus = ProcessingStatus.FAILED;
      throw error;
    }
  }

  private async extractFromPDF(filePath: string): Promise<{ text: string; confidence: number }> {
    try {
      const data = await this.pdfExtractor.extract(filePath, {});
      const text = data.pages
        .map(page => page.content.map(item => item.str).join(' '))
        .join('\n');

      return {
        text,
        confidence: 0.95, // PDF text extraction is usually highly accurate
      };
    } catch (error) {
      logger.error('PDF extraction error:', error);
      throw error;
    }
  }

  private async extractFromImage(filePath: string): Promise<{ text: string; confidence: number }> {
    try {
      const result = await Tesseract.recognize(filePath, 'eng', {
        logger: m => logger.debug('OCR progress:', m),
      });

      return {
        text: result.data.text,
        confidence: result.data.confidence / 100,
      };
    } catch (error) {
      logger.error('OCR extraction error:', error);
      throw error;
    }
  }

  private async analyzeAndExtractData(text: string, document: Document): Promise<ExtractedData> {
    const documentType = this.identifyDocumentType(text);
    
    const extractedData: ExtractedData = {
      trades: [],
      bankTransactions: [],
      portfolioHoldings: [],
      taxDocuments: [],
      metadata: {
        documentType,
        confidence: document.metadata.ocrConfidence || 0,
      },
    };

    switch (documentType) {
      case 'CONTRACT_NOTE':
        extractedData.trades = this.extractTrades(text);
        extractedData.metadata.broker = this.identifyBroker(text);
        break;
      
      case 'BANK_STATEMENT':
        extractedData.bankTransactions = this.extractBankTransactions(text);
        extractedData.metadata.accountNumber = this.extractAccountNumber(text);
        break;
      
      case 'PORTFOLIO_STATEMENT':
        extractedData.portfolioHoldings = this.extractPortfolioHoldings(text);
        extractedData.metadata.broker = this.identifyBroker(text);
        break;
      
      case 'TAX_DOCUMENT':
        extractedData.taxDocuments = this.extractTaxInformation(text);
        break;
    }

    // Extract period information
    extractedData.metadata.period = this.extractPeriod(text);

    return extractedData;
  }

  private identifyDocumentType(text: string): string {
    const lowercaseText = text.toLowerCase();
    
    if (lowercaseText.includes('contract note') || 
        lowercaseText.includes('trade confirmation')) {
      return 'CONTRACT_NOTE';
    }
    
    if (lowercaseText.includes('bank statement') || 
        lowercaseText.includes('account statement')) {
      return 'BANK_STATEMENT';
    }
    
    if (lowercaseText.includes('portfolio') || 
        lowercaseText.includes('holdings')) {
      return 'PORTFOLIO_STATEMENT';
    }
    
    if (lowercaseText.includes('income tax') || 
        lowercaseText.includes('itr') ||
        lowercaseText.includes('form 16')) {
      return 'TAX_DOCUMENT';
    }
    
    return 'UNKNOWN';
  }

  private extractTrades(text: string): ExtractedData['trades'] {
    const trades: ExtractedData['trades'] = [];
    const lines = text.split('\n');
    
    // Pattern for typical contract note format
    const tradePattern = /(\d{2}\/\d{2}\/\d{4})\s+([A-Z]+)\s+(BUY|SELL)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/g;
    
    let match;
    while ((match = tradePattern.exec(text)) !== null) {
      const [, date, symbol, side, quantity, price, amount] = match;
      
      trades.push({
        date,
        symbol,
        side: side.toLowerCase() as 'buy' | 'sell',
        quantity: parseInt(quantity.replace(/,/g, '')),
        price: parseFloat(price.replace(/,/g, '')),
        amount: parseFloat(amount.replace(/,/g, '')),
        charges: this.extractCharges(text, symbol),
      });
    }
    
    return trades;
  }

  private extractBankTransactions(text: string): ExtractedData['bankTransactions'] {
    const transactions: ExtractedData['bankTransactions'] = [];
    const lines = text.split('\n');
    
    // Pattern for bank statement transactions
    const transactionPattern = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,.]+)?\s+([\d,.]+)?\s+([\d,.]+)/g;
    
    let match;
    while ((match = transactionPattern.exec(text)) !== null) {
      const [, date, description, debit, credit, balance] = match;
      
      transactions.push({
        date,
        description: description.trim(),
        debit: debit ? parseFloat(debit.replace(/,/g, '')) : undefined,
        credit: credit ? parseFloat(credit.replace(/,/g, '')) : undefined,
        balance: parseFloat(balance.replace(/,/g, '')),
      });
    }
    
    return transactions;
  }

  private extractPortfolioHoldings(text: string): ExtractedData['portfolioHoldings'] {
    const holdings: ExtractedData['portfolioHoldings'] = [];
    
    // Pattern for portfolio holdings
    const holdingPattern = /([A-Z]+)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/g;
    
    let match;
    while ((match = holdingPattern.exec(text)) !== null) {
      const [, symbol, quantity, averagePrice, currentPrice, value] = match;
      
      holdings.push({
        symbol,
        quantity: parseInt(quantity.replace(/,/g, '')),
        averagePrice: parseFloat(averagePrice.replace(/,/g, '')),
        currentPrice: parseFloat(currentPrice.replace(/,/g, '')),
        value: parseFloat(value.replace(/,/g, '')),
      });
    }
    
    return holdings;
  }

  private extractTaxInformation(text: string): ExtractedData['taxDocuments'] {
    const taxDocs: ExtractedData['taxDocuments'] = [];
    
    // Extract tax-related information
    const incomeMatch = text.match(/total\s+income[:\s]+([\d,.]+)/i);
    const taxMatch = text.match(/tax\s+paid[:\s]+([\d,.]+)/i);
    const refundMatch = text.match(/refund[:\s]+([\d,.]+)/i);
    const ayMatch = text.match(/assessment\s+year[:\s]+(\d{4}-\d{2})/i);
    
    if (incomeMatch || taxMatch) {
      taxDocs.push({
        documentType: 'ITR',
        assessmentYear: ayMatch ? ayMatch[1] : '',
        totalIncome: incomeMatch ? parseFloat(incomeMatch[1].replace(/,/g, '')) : 0,
        taxPaid: taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : 0,
        refund: refundMatch ? parseFloat(refundMatch[1].replace(/,/g, '')) : undefined,
      });
    }
    
    return taxDocs;
  }

  private identifyBroker(text: string): string {
    const brokers = [
      { name: 'Zerodha', patterns: ['zerodha', 'kite'] },
      { name: 'Upstox', patterns: ['upstox', 'rksv'] },
      { name: 'Angel Broking', patterns: ['angel', 'angelbroking'] },
      { name: 'ICICI Direct', patterns: ['icici direct', 'icicidirect'] },
      { name: 'HDFC Securities', patterns: ['hdfc securities', 'hdfcsec'] },
      { name: 'Kotak Securities', patterns: ['kotak securities', 'kotaksecurities'] },
      { name: 'SBI Securities', patterns: ['sbi securities', 'sbisec'] },
    ];
    
    const lowercaseText = text.toLowerCase();
    
    for (const broker of brokers) {
      if (broker.patterns.some(pattern => lowercaseText.includes(pattern))) {
        return broker.name;
      }
    }
    
    return 'Unknown';
  }

  private extractCharges(text: string, symbol: string): { brokerage?: number; stt?: number; gst?: number } {
    const charges: { brokerage?: number; stt?: number; gst?: number } = {};
    
    // Extract charges specific to this trade
    const chargesPattern = new RegExp(`${symbol}.*?brokerage[:\\s]+([\d,.]+)`, 'i');
    const sttPattern = new RegExp(`${symbol}.*?stt[:\\s]+([\d,.]+)`, 'i');
    const gstPattern = new RegExp(`${symbol}.*?gst[:\\s]+([\d,.]+)`, 'i');
    
    const brokerageMatch = text.match(chargesPattern);
    const sttMatch = text.match(sttPattern);
    const gstMatch = text.match(gstPattern);
    
    if (brokerageMatch) {
      charges.brokerage = parseFloat(brokerageMatch[1].replace(/,/g, ''));
    }
    if (sttMatch) {
      charges.stt = parseFloat(sttMatch[1].replace(/,/g, ''));
    }
    if (gstMatch) {
      charges.gst = parseFloat(gstMatch[1].replace(/,/g, ''));
    }
    
    return charges;
  }

  private extractAccountNumber(text: string): string {
    const accountPattern = /account\s+no[:\s]+(\d+)/i;
    const match = text.match(accountPattern);
    return match ? match[1] : '';
  }

  private extractPeriod(text: string): { from: string; to: string } | undefined {
    const periodPattern = /(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i;
    const match = text.match(periodPattern);
    
    if (match) {
      return {
        from: match[1],
        to: match[2],
      };
    }
    
    return undefined;
  }

  async validateExtractedData(extractedData: ExtractedData): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate trades
    for (const trade of extractedData.trades) {
      if (trade.quantity <= 0) {
        errors.push(`Invalid quantity for trade: ${trade.symbol}`);
      }
      if (trade.price <= 0) {
        errors.push(`Invalid price for trade: ${trade.symbol}`);
      }
      if (Math.abs(trade.amount - (trade.quantity * trade.price)) > 1) {
        warnings.push(`Amount calculation mismatch for trade: ${trade.symbol}`);
      }
    }
    
    // Validate bank transactions
    for (const transaction of extractedData.bankTransactions) {
      if (transaction.balance < 0 && !transaction.description.toLowerCase().includes('overdraft')) {
        warnings.push(`Negative balance detected: ${transaction.date}`);
      }
    }
    
    // Validate portfolio holdings
    for (const holding of extractedData.portfolioHoldings) {
      if (holding.quantity <= 0) {
        errors.push(`Invalid quantity for holding: ${holding.symbol}`);
      }
      if (holding.currentPrice <= 0) {
        warnings.push(`Invalid current price for holding: ${holding.symbol}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}