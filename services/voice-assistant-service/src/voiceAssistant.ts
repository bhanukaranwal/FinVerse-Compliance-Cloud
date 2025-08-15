import { SpeechToText, TextToSpeech } from './speechServices';
import { NaturalLanguageProcessor } from './nlpEngine';
import { VoiceCommand, VoiceResponse, VoiceSession } from './types';
import { logger } from '../utils/logger';

export interface VoiceCommand {
  id: string;
  userId: string;
  sessionId: string;
  text: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  timestamp: Date;
  audioData?: Buffer;
  language: string;
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  actions: Array<{
    type: 'DISPLAY_CHART' | 'EXECUTE_TRADE' | 'SHOW_PORTFOLIO' | 'NAVIGATE';
    data: any;
  }>;
  followUpQuestions: string[];
  context: Record<string, any>;
}

export interface VoiceSession {
  id: string;
  userId: string;
  isActive: boolean;
  context: ConversationContext;
  startedAt: Date;
  lastActivity: Date;
  commands: VoiceCommand[];
  preferences: VoicePreferences;
}

export interface ConversationContext {
  currentSymbol?: string;
  currentPortfolio?: string;
  currentTimeframe?: string;
  lastAction?: string;
  pendingTrade?: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity?: number;
    price?: number;
  };
  conversationHistory: Array<{
    type: 'USER' | 'ASSISTANT';
    text: string;
    timestamp: Date;
  }>;
}

export interface VoicePreferences {
  language: string;
  voice: string;
  speed: number;
  pitch: number;
  confirmations: boolean;
  autoExecute: boolean;
  wakeWord: string;
}

export class AdvancedVoiceAssistant {
  private speechToText: SpeechToText;
  private textToSpeech: TextToSpeech;
  private nlpEngine: NaturalLanguageProcessor;
  private activeSessions: Map<string, VoiceSession> = new Map();
  private supportedLanguages = ['en-US', 'hi-IN', 'gu-IN', 'mr-IN', 'ta-IN', 'te-IN'];

  constructor() {
    this.speechToText = new SpeechToText();
    this.textToSpeech = new TextToSpeech();
    this.nlpEngine = new NaturalLanguageProcessor();
  }

  async initialize() {
    await this.nlpEngine.loadModels();
    await this.loadVoiceCommands();
    logger.info('Voice assistant initialized with multilingual support');
  }

  async startVoiceSession(userId: string, preferences: VoicePreferences): Promise<VoiceSession> {
    const session: VoiceSession = {
      id: `voice_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      isActive: true,
      context: {
        conversationHistory: [],
      },
      startedAt: new Date(),
      lastActivity: new Date(),
      commands: [],
      preferences,
    };

    this.activeSessions.set(session.id, session);
    
    const welcomeResponse = await this.generateWelcomeMessage(userId, preferences.language);
    return session;
  }

  async processVoiceCommand(sessionId: string, audioData: Buffer): Promise<VoiceResponse> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error('Invalid or inactive voice session');
    }

    try {
      // Convert speech to text
      const transcription = await this.speechToText.transcribe(
        audioData, 
        session.preferences.language
      );

      // Process with NLP
      const nlpResult = await this.nlpEngine.process(
        transcription.text, 
        session.context,
        session.preferences.language
      );

      // Create voice command record
      const command: VoiceCommand = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: session.userId,
        sessionId,
        text: transcription.text,
        intent: nlpResult.intent,
        entities: nlpResult.entities,
        confidence: Math.min(transcription.confidence, nlpResult.confidence),
        timestamp: new Date(),
        audioData,
        language: session.preferences.language,
      };

      session.commands.push(command);
      session.lastActivity = new Date();

      // Generate response based on intent
      const response = await this.generateResponse(command, session);

      // Update conversation history
      session.context.conversationHistory.push(
        { type: 'USER', text: transcription.text, timestamp: new Date() },
        { type: 'ASSISTANT', text: response.text, timestamp: new Date() }
      );

      // Generate audio response
      if (session.preferences.voice) {
        response.audioUrl = await this.generateAudioResponse(
          response.text, 
          session.preferences
        );
      }

      logger.info(`Voice command processed: ${command.intent} with confidence ${command.confidence}`);
      return response;

    } catch (error) {
      logger.error('Error processing voice command:', error);
      return this.generateErrorResponse(session.preferences.language);
    }
  }

  private async generateResponse(command: VoiceCommand, session: VoiceSession): Promise<VoiceResponse> {
    const { intent, entities } = command;
    const context = session.context;
    const lang = session.preferences.language;

    switch (intent) {
      case 'GET_STOCK_PRICE':
        return await this.handleStockPriceQuery(entities, context, lang);
        
      case 'GET_PORTFOLIO':
        return await this.handlePortfolioQuery(session.userId, entities, lang);
        
      case 'PLACE_ORDER':
        return await this.handleTradeOrder(entities, context, session, lang);
        
      case 'GET_MARKET_NEWS':
        return await this.handleMarketNews(entities, lang);
        
      case 'TECHNICAL_ANALYSIS':
        return await this.handleTechnicalAnalysis(entities, context, lang);
        
      case 'CALCULATE_TAX':
        return await this.handleTaxCalculation(session.userId, entities, lang);
        
      case 'COMPLIANCE_CHECK':
        return await this.handleComplianceCheck(session.userId, entities, lang);
        
      case 'SET_ALERT':
        return await this.handleSetAlert(session.userId, entities, lang);
        
      default:
        return await this.handleUnknownIntent(command.text, lang);
    }
  }

  private async handleStockPriceQuery(
    entities: Record<string, any>, 
    context: ConversationContext, 
    language: string
  ): Promise<VoiceResponse> {
    const symbol = entities.symbol || context.currentSymbol;
    
    if (!symbol) {
      return {
        text: this.localize('MISSING_SYMBOL', language),
        actions: [],
        followUpQuestions: [
          this.localize('WHICH_STOCK', language),
        ],
        context: {},
      };
    }

    const stockData = await this.getStockData(symbol);
    const priceText = this.formatStockPrice(stockData, language);
    
    // Update context
    context.currentSymbol = symbol;
    
    return {
      text: priceText,
      actions: [{
        type: 'DISPLAY_CHART',
        data: { symbol, timeframe: '1D' },
      }],
      followUpQuestions: [
        this.localize('WANT_TO_BUY_SELL', language, { symbol }),
        this.localize('TECHNICAL_ANALYSIS', language, { symbol }),
      ],
      context: { currentSymbol: symbol },
    };
  }

  private async handleTradeOrder(
    entities: Record<string, any>,
    context: ConversationContext,
    session: VoiceSession,
    language: string
  ): Promise<VoiceResponse> {
    const symbol = entities.symbol || context.currentSymbol;
    const side = entities.side; // 'buy' or 'sell'
    const quantity = entities.quantity;
    const price = entities.price;

    if (!symbol || !side) {
      return {
        text: this.localize('INCOMPLETE_ORDER', language),
        actions: [],
        followUpQuestions: [
          this.localize('SPECIFY_SYMBOL_SIDE', language),
        ],
        context: {},
      };
    }

    // Store pending trade in context
    context.pendingTrade = { symbol, side, quantity, price };

    if (!quantity) {
      const suggestions = await this.suggestQuantity(session.userId, symbol, side);
      return {
        text: this.localize('HOW_MANY_SHARES', language, { symbol }),
        actions: [],
        followUpQuestions: suggestions.map(s => 
          this.localize('SUGGEST_QUANTITY', language, { quantity: s.quantity, amount: s.amount })
        ),
        context: { pendingTrade: context.pendingTrade },
      };
    }

    // Confirmation required
    if (session.preferences.confirmations) {
      const orderSummary = this.formatOrderSummary(context.pendingTrade, language);
      return {
        text: this.localize('CONFIRM_ORDER', language) + ' ' + orderSummary,
        actions: [],
        followUpQuestions: [
          this.localize('YES_CONFIRM', language),
          this.localize('NO_CANCEL', language),
          this.localize('MODIFY_ORDER', language),
        ],
        context: { pendingTrade: context.pendingTrade },
      };
    }

    // Execute trade
    const result = await this.executeTrade(session.userId, context.pendingTrade);
    context.pendingTrade = undefined;

    return {
      text: this.localize('ORDER_EXECUTED', language, result),
      actions: [{
        type: 'SHOW_PORTFOLIO',
        data: { refresh: true },
      }],
      followUpQuestions: [
        this.localize('ANYTHING_ELSE', language),
      ],
      context: {},
    };
  }

  private async handleTechnicalAnalysis(
    entities: Record<string, any>,
    context: ConversationContext,
    language: string
  ): Promise<VoiceResponse> {
    const symbol = entities.symbol || context.currentSymbol;
    const indicator = entities.indicator;
    const timeframe = entities.timeframe || '1D';

    if (!symbol) {
      return {
        text: this.localize('MISSING_SYMBOL_ANALYSIS', language),
        actions: [],
        followUpQuestions: [],
        context: {},
      };
    }

    const analysis = await this.getTechnicalAnalysis(symbol, indicator, timeframe);
    const analysisText = this.formatTechnicalAnalysis(analysis, language);

    return {
      text: analysisText,
      actions: [{
        type: 'DISPLAY_CHART',
        data: { 
          symbol, 
          timeframe, 
          indicators: indicator ? [indicator] : ['RSI', 'MACD', 'SMA'] 
        },
      }],
      followUpQuestions: [
        this.localize('OTHER_INDICATORS', language),
        this.localize('DIFFERENT_TIMEFRAME', language),
      ],
      context: { currentSymbol: symbol, currentTimeframe: timeframe },
    };
  }

  private async handleTaxCalculation(
    userId: string,
    entities: Record<string, any>,
    language: string
  ): Promise<VoiceResponse> {
    const year = entities.year || new Date().getFullYear();
    const calculation = await this.calculateTaxes(userId, year);
    const taxText = this.formatTaxSummary(calculation, language);

    return {
      text: taxText,
      actions: [{
        type: 'NAVIGATE',
        data: { route: '/tax/dashboard' },
      }],
      followUpQuestions: [
        this.localize('OPTIMIZE_TAX', language),
        this.localize('GENERATE_ITR', language),
      ],
      context: {},
    };
  }

  private async generateAudioResponse(text: string, preferences: VoicePreferences): Promise<string> {
    const audioBuffer = await this.textToSpeech.synthesize(text, {
      language: preferences.language,
      voice: preferences.voice,
      speed: preferences.speed,
      pitch: preferences.pitch,
    });

    // Upload to storage and return URL
    const audioUrl = await this.uploadAudio(audioBuffer);
    return audioUrl;
  }

  private localize(key: string, language: string, params?: Record<string, any>): string {
    const translations = this.getTranslations(language);
    let text = translations[key] || key;
    
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, params[param]);
      });
    }
    
    return text;
  }

  private getTranslations(language: string): Record<string, string> {
    const translations: Record<string, Record<string, string>> = {
      'en-US': {
        'MISSING_SYMBOL': 'Which stock would you like to check?',
        'WHICH_STOCK': 'Which stock are you interested in?',
        'WANT_TO_BUY_SELL': 'Would you like to buy or sell {symbol}?',
        'TECHNICAL_ANALYSIS': 'Should I show technical analysis for {symbol}?',
        'INCOMPLETE_ORDER': 'I need more details about your order.',
        'HOW_MANY_SHARES': 'How many shares of {symbol} would you like to buy?',
        'CONFIRM_ORDER': 'Please confirm your order:',
        'ORDER_EXECUTED': 'Your order has been executed successfully.',
        'ANYTHING_ELSE': 'Is there anything else I can help you with?',
      },
      'hi-IN': {
        'MISSING_SYMBOL': 'आप कौन सा स्टॉक चेक करना चाहते हैं?',
        'WHICH_STOCK': 'आप किस स्टॉक में रुचि रखते हैं?',
        'WANT_TO_BUY_SELL': 'क्या आप {symbol} खरीदना या बेचना चाहते हैं?',
        'TECHNICAL_ANALYSIS': 'क्या मैं {symbol} के लिए तकनीकी विश्लेषण दिखाऊं?',
        'INCOMPLETE_ORDER': 'मुझे आपके ऑर्डर के बारे में और जानकारी चाहिए।',
        'HOW_MANY_SHARES': 'आप {symbol} के कितने शेयर खरीदना चाहते हैं?',
        'CONFIRM_ORDER': 'कृपया अपने ऑर्डर की पुष्टि करें:',
        'ORDER_EXECUTED': 'आपका ऑर्डर सफलतापूर्वक निष्पादित हो गया है।',
        'ANYTHING_ELSE': 'क्या कोई और चीज़ है जिसमें मैं आपकी मदद कर सकूं?',
      },
      // Add more languages...
    };

    return translations[language] || translations['en-US'];
  }
}