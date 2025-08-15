  private async executeAlertAction(action: AlertAction, alert: SmartAlert, triggerData: Record<string, any>): Promise<void> {
    switch (action.type) {
      case 'NOTIFICATION':
        await this.sendIntelligentNotification(
          alert.userId,
          action.template,
          { ...action.parameters, ...triggerData },
          'HIGH'
        );
        break;
        
      case 'EMAIL':
        await this.sendDirectEmail(alert.userId, action, triggerData);
        break;
        
      case 'SMS':
        await this.sendDirectSMS(alert.userId, action, triggerData);
        break;
        
      case 'WEBHOOK':
        await this.callWebhook(action.webhook_url!, { alert, triggerData });
        break;
        
      case 'AUTO_TRADE':
        await this.executeAutoTrade(alert.userId, action.trade_action!, triggerData);
        break;
    }
  }

  private async executeAutoTrade(userId: string, tradeAction: AlertAction['trade_action'], triggerData: Record<string, any>): Promise<void> {
    logger.info(`Executing auto-trade for user ${userId}: ${JSON.stringify(tradeAction)}`);
    
    // Validate auto-trading permissions
    const hasPermission = await this.checkAutoTradingPermission(userId);
    if (!hasPermission) {
      throw new Error('User does not have auto-trading permission');
    }

    // Execute the trade through trading service
    const trade = {
      userId,
      symbol: tradeAction!.symbol,
      side: tradeAction!.side.toLowerCase() as 'buy' | 'sell',
      quantity: tradeAction!.quantity,
      orderType: tradeAction!.order_type.toLowerCase(),
      price: tradeAction!.price,
      metadata: {
        isAutoTrade: true,
        triggeredBy: 'SMART_ALERT',
        triggerData,
      },
    };

    await this.executeTrade(trade);
  }
}