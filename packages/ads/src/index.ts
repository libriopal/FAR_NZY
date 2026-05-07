// ─── AppLovin MAX Integration Layer ──────────────────────────────────────────
// Abstracts AppLovin SDK for Web (via AppLovin Exchange JS) + Capacitor plugin.
// Rewarded ads and interstitials only — no banner ads in gameplay.

export type AdType = 'rewarded' | 'interstitial';
export type AdRewardType = 'revive' | 'booster' | 'daily_free';

export interface AdReward {
  type: AdRewardType;
  goldCoins: number;
  sweepsCoins: number;
}

export interface AdCallbacks {
  onLoaded: (adType: AdType) => void;
  onFailed: (adType: AdType, error: string) => void;
  onShown: (adType: AdType) => void;
  onClicked: (adType: AdType) => void;
  onHidden: (adType: AdType) => void;
  onRewarded: (reward: AdReward) => void;
}

export class AdManager {
  private initialized = false;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private callbacks: Partial<AdCallbacks> = {};
  private sdkKey = '';
  private adUnitIds: { rewarded: string; interstitial: string } = {
    rewarded: '',
    interstitial: '',
  };

  configure(config: {
    sdkKey: string;
    rewardedAdUnitId: string;
    interstitialAdUnitId: string;
  }): void {
    this.sdkKey = config.sdkKey;
    this.adUnitIds.rewarded = config.rewardedAdUnitId;
    this.adUnitIds.interstitial = config.interstitialAdUnitId;
  }

  setCallbacks(cbs: Partial<AdCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Check if running in Capacitor (native)
    if (this._isCapacitor()) {
      await this._initCapacitorSDK();
    } else {
      await this._initWebSDK();
    }

    this.initialized = true;
    this.loadRewarded();
  }

  loadRewarded(): void {
    if (!this.initialized) return;
    if (this._isCapacitor()) {
      // @ts-ignore — Capacitor plugin loaded at runtime
      window.AppLovinMAX?.loadRewardedAd(this.adUnitIds.rewarded);
    } else {
      this.rewardedLoaded = true; // Web stub — immediately "ready"
    }
  }

  loadInterstitial(): void {
    if (!this.initialized) return;
    if (this._isCapacitor()) {
      // @ts-ignore
      window.AppLovinMAX?.loadInterstitial(this.adUnitIds.interstitial);
    } else {
      this.interstitialLoaded = true;
    }
  }

  isRewardedReady(): boolean {
    if (this._isCapacitor()) {
      // @ts-ignore
      return window.AppLovinMAX?.isRewardedAdReady(this.adUnitIds.rewarded) ?? false;
    }
    return this.rewardedLoaded;
  }

  async showRewarded(rewardType: AdRewardType): Promise<AdReward | null> {
    if (!this.isRewardedReady()) {
      this.loadRewarded();
      return null;
    }

    return new Promise((resolve) => {
      if (this._isCapacitor()) {
        const onRewarded = (info: { reward: { label: string; amount: number } }) => {
          const reward = this._buildReward(rewardType);
          this.callbacks.onRewarded?.(reward);
          resolve(reward);
        };
        // @ts-ignore
        window.AppLovinMAX?.showRewardedAd(this.adUnitIds.rewarded, onRewarded);
      } else {
        // Web: simulate ad view for development
        setTimeout(() => {
          const reward = this._buildReward(rewardType);
          this.callbacks.onRewarded?.(reward);
          this.callbacks.onHidden?.('rewarded');
          this.loadRewarded(); // Preload next
          resolve(reward);
        }, 1500);
      }
    });
  }

  showInterstitial(): void {
    if (!this.interstitialLoaded) return;
    if (this._isCapacitor()) {
      // @ts-ignore
      window.AppLovinMAX?.showInterstitial(this.adUnitIds.interstitial);
    } else {
      setTimeout(() => {
        this.callbacks.onHidden?.('interstitial');
        this.interstitialLoaded = false;
        this.loadInterstitial();
      }, 2000);
    }
  }

  private _buildReward(type: AdRewardType): AdReward {
    const REWARDS: Record<AdRewardType, AdReward> = {
      revive: { type: 'revive', goldCoins: 500, sweepsCoins: 0 },
      booster: { type: 'booster', goldCoins: 300, sweepsCoins: 0 },
      daily_free: { type: 'daily_free', goldCoins: 200, sweepsCoins: 5 },
    };
    return REWARDS[type];
  }

  private _isCapacitor(): boolean {
    return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).Capacitor;
  }

  private async _initCapacitorSDK(): Promise<void> {
    // AppLovin Capacitor plugin initialized via Capacitor bridge
    // Plugin must be installed: npm i @applovin-enterprise/capacitor-plugin-applovin-max
    // @ts-ignore
    await window.AppLovinMAX?.initialize({ sdkKey: this.sdkKey });
  }

  private async _initWebSDK(): Promise<void> {
    // For web PWA — AppLovin doesn't have a full web SDK for in-app ads
    // In production, web users see a "Watch Ad" button that triggers a server-side
    // reward after viewing a 3rd-party ad served in an iframe
    console.log('[Ads] Web SDK initialized (stub mode)');
  }
}

export const adManager = new AdManager();
