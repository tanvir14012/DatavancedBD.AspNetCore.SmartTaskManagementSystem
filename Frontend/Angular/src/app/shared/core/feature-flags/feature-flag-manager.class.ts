/**
 * Feature Flags system supporting boolean, role-based, percentage, environment, and time-based flags
 */

export enum FeatureFlagType {
  BOOLEAN = 'boolean',
  ROLE_BASED = 'roleBased',
  PERCENTAGE = 'percentage',
  ENVIRONMENT = 'environment',
  TIME_BASED = 'timeBased',
}

export interface IFeatureFlag {
  name: string;
  type: FeatureFlagType;
  enabled: boolean;
}

export class FeatureFlagManager {
  private flags = new Map<string, IFeatureFlag>();
  private userRoles: Set<string> = new Set();
  private environment = process.env.NODE_ENV || 'development';
  private userId?: string;

  setUserRoles(roles: string[]): void {
    this.userRoles = new Set(roles);
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  registerFlag(flag: IFeatureFlag): void {
    this.flags.set(flag.name, flag);
  }

  isEnabled(flagName: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    return flag.enabled;
  }

  isEnabledForRole(flagName: string, requiredRoles: string[]): boolean {
    if (!this.isEnabled(flagName)) return false;
    return requiredRoles.some(role => this.userRoles.has(role));
  }

  isEnabledForUser(flagName: string, percentage: number): boolean {
    if (!this.isEnabled(flagName) || !this.userId) return false;
    const hash = this.simpleHash(this.userId);
    return (hash % 100) < percentage;
  }

  isEnabledForEnvironment(flagName: string, environments: string[]): boolean {
    if (!this.isEnabled(flagName)) return false;
    return environments.includes(this.environment);
  }

  isEnabledInTimeRange(
    flagName: string,
    startTime: Date,
    endTime: Date
  ): boolean {
    if (!this.isEnabled(flagName)) return false;
    const now = new Date();
    return now >= startTime && now <= endTime;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Example usage:
 * 
 * const manager = new FeatureFlagManager();
 * manager.registerFlag({ name: 'newDashboard', type: FeatureFlagType.BOOLEAN, enabled: true });
 * 
 * if (manager.isEnabled('newDashboard')) {
 *   // Use new dashboard
 * }
 */
