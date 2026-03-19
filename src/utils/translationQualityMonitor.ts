/**
 * Translation Quality Monitor
 * Tracks translation quality and provides feedback
 */

export interface TranslationQualityMetrics {
  totalTranslations: number;
  customTranslationsUsed: number;
  apiTranslationsUsed: number;
  errors: number;
  averageResponseTime: number;
}

class TranslationQualityMonitor {
  private metrics: TranslationQualityMetrics = {
    totalTranslations: 0,
    customTranslationsUsed: 0,
    apiTranslationsUsed: 0,
    errors: 0,
    averageResponseTime: 0
  };

  private responseTimes: number[] = [];

  /**
   * Track translation attempt
   */
  trackTranslation(startTime: number, usedCustom: boolean, hadError: boolean): void {
    const responseTime = Date.now() - startTime;
    this.responseTimes.push(responseTime);
    
    this.metrics.totalTranslations++;
    this.metrics.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    if (usedCustom) {
      this.metrics.customTranslationsUsed++;
    } else {
      this.metrics.apiTranslationsUsed++;
    }
    
    if (hadError) {
      this.metrics.errors++;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): TranslationQualityMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if translation quality is good
   */
  isQualityGood(): boolean {
    const errorRate = this.metrics.errors / this.metrics.totalTranslations;
    const customUsageRate = this.metrics.customTranslationsUsed / this.metrics.totalTranslations;
    
    // Quality is good if error rate < 5% and custom usage > 20%
    return errorRate < 0.05 && customUsageRate > 0.2;
  }

  /**
   * Get quality recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const errorRate = this.metrics.errors / this.metrics.totalTranslations;
    const customUsageRate = this.metrics.customTranslationsUsed / this.metrics.totalTranslations;
    
    if (errorRate > 0.05) {
      recommendations.push("High error rate detected. Consider improving API reliability.");
    }
    
    if (customUsageRate < 0.2) {
      recommendations.push("Low custom dictionary usage. Add more terms to translationDictionary.ts");
    }
    
    if (this.metrics.averageResponseTime > 2000) {
      recommendations.push("Slow translation responses. Consider caching or optimization.");
    }
    
    return recommendations;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      totalTranslations: 0,
      customTranslationsUsed: 0,
      apiTranslationsUsed: 0,
      errors: 0,
      averageResponseTime: 0
    };
    this.responseTimes = [];
  }
}

export const translationQualityMonitor = new TranslationQualityMonitor();
